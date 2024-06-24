import express from 'express'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import bodyParser from 'body-parser'
import svgCaptcha from 'svg-captcha'
import { nanoid } from 'nanoid'
import { RPC as WalletRPC } from '@xelis/sdk/wallet/rpc'
import { RPC as DaemonRPC } from '@xelis/sdk/daemon/rpc'
import { XELIS_ASSET } from '@xelis/sdk/config'
import dotenv from 'dotenv'

dotenv.config()
const app = express()
const port = process.env.PORT || 4000
const hostname = process.env.HOSTNAME || `127.0.0.1`

app.use(bodyParser.json())

const dbLocation = process.env.DB_LOCATION || `./faucet.db`
const db = await open({
  filename: dbLocation,
  driver: sqlite3.Database
})

const DRIP_TIMEOUT = 300000 // 5m
const DRIP_AMOUNT = 100000 // atomic value so .001 XEL
const SEND_INTERVAL = 60000 // 1m
const MAX_CAPTCHA_TRIES = 3

const useCORS = process.env.USE_CORS || 'false'

const daemonEndpoint = process.env.DAEMON_ENDPOINT
const daemon = new DaemonRPC(daemonEndpoint)

const info = await daemon.getInfo()
console.log(`Successful daemon fetch at ${daemonEndpoint}.`)

const walletEndpoint = process.env.WALLET_ENDPOINT
const walletUsername = process.env.WALLET_USERNAME
const walletPassword = process.env.WALLET_PASSWORD
const wallet = new WalletRPC(walletEndpoint, walletUsername, walletPassword)

const res = await wallet.getAddress()
console.log(`Successful wallet fetch ${res.result} at ${walletEndpoint}.`)

const sessions = new Map() // address, solution, tries, valid

await db.run(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address VARCHAR,
    tx_hash VARCHAR,
    amount INTEGER,
    timestamp INTEGER
  )
`)

function resError(res, err) {
  res.status(400).json({ error: err.message })
}

if (useCORS.toLowerCase() === 'true') {
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    next()
  })
}

app.post('/stats', async (req, res) => {
  try {
    const row = await db.get(`
      SELECT 
        COUNT(*) AS drips,
        SUM(amount) AS total_sent,
        COUNT(DISTINCT address) AS unique_accounts,
        MAX(timestamp) AS last_drip
      FROM transactions
    `, [])
    res.status(200).send({ ...row, session_count: sessions.size })
  } catch (err) {
    resError(res, err)
  }
})

app.post('/txs', async (req, res) => {
  try {
    const page = parseInt(req.body.page) || 1
    const size = parseInt(req.body.size) || 30

    const offset = (page - 1) * size

    const rows = await db.all(`SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ? OFFSET ?`, [size, offset])
    res.status(200).send(rows)
  } catch (err) {
    resError(res, err)
  }
})

app.post('/request-drip', async (req, res) => {
  const { address } = req.body

  if (!address || address.length === 0) {
    resError(res, new Error(`Missing field "address".`))
    return
  }

  for (const [id, session] of sessions) {
    if (session.address === address) {
      if (session.valid) {
        resError(res, new Error(`This wallet address is already in drip pool.`))
        return
      } else {
        sessions.delete(id)
        break
      }
    }
  }

  const timestamp = new Date().getTime()
  let lastTx = null
  try {
    lastTx = await db.get(`SELECT * FROM transactions WHERE address = ? ORDER BY timestamp DESC LIMIT 1`, [address])
  } catch (err) {
    resError(res, err)
    return
  }


  if (lastTx && timestamp - lastTx.timestamp < DRIP_TIMEOUT) {
    resError(res, new Error(`This address is in cooldown.`))
    return
  }

  // using svg captcha to avoid bots
  // maybe you can train a AI on opentype, match svg letter paths and bypass the captcha?
  // this requires works so this solution can mitigate bots for now
  // we might have to find another solution / alternative for production faucet
  // add limiting by ip address?

  const captcha = svgCaptcha.create({ size: 6, noise: 10, ignoreChars: `oO0iIlL1` })
  const id = nanoid()
  const newSession = { address, solution: captcha.text.toLowerCase(), tries: 0, valid: false }
  sessions.set(id, newSession)
  res.status(200).send({ sessionId: id, captcha: captcha.data })
})

app.post('/confirm-drip', async (req, res) => {
  const { sessionId, solution } = req.body

  let session = sessions.get(sessionId)
  if (!session) {
    resError(res, new Error(`The session id is invalid.`))
    return
  }

  if (session.solution !== solution.toLowerCase()) {
    session.tries++

    if (session.tries > MAX_CAPTCHA_TRIES) {
      sessions.delete(sessionId)
      resError(res, new Error(`Maximum number of attempts reached for sending a valid captcha.`))
      return
    }

    sessions.set(sessionId, session)
    resError(res, new Error(`The captcha id is invalid.`))
    return
  }

  // check if valid address
  try {
    const res = await daemon.validateAddress({
      address: session.address,
      allow_integrated: false
    })
    const validAddress = res.result.is_valid

    if (!validAddress) {
      sessions.delete(sessionId)
      resError(res, new Error(`The address is not a valid XELIS address.`))
      return
    }
  } catch (err) {
    sessions.delete(sessionId)
    resError(res, err)
    return
  }

  sessions.set(sessionId, { ...session, valid: true })
  res.status(200).send({})
})

app.get(`*`, (req, res) => {
  res.status(200).send("XELIS Faucet API")
})

async function sendTransactions() {
  const accounts = []

  for (const [id, session] of sessions) {
    const { valid, address } = session
    if (valid) {
      accounts.push({ address, sessionId: id })
    }
  }

  if (accounts.length === 0) return
  const timestamp = new Date().getTime()
  const total = accounts.length * DRIP_AMOUNT

  try {
    const res = await wallet.getBalance()
    const balance = res.result
    if (total >= balance) {
      console.log(`Faucet can't drip... need refill.`)
      return
    }
  } catch (err) {
    console.log(err)
    return
  }

  let txHash, txHex
  try {
    const transfers = accounts.map((account) => ({
      amount: DRIP_AMOUNT,
      asset: XELIS_ASSET,
      destination: account.address,
    }))

    const res = await wallet.buildTransaction({ broadcast: false, transfers, tx_as_hex: true })
    txHex = res.result.tx_as_hex
    txHash = res.result.hash
  } catch (err) {
    console.log(err)
    return
  }

  const operations = accounts.map((account) => ({
    query: `INSERT INTO transactions (address, tx_hash, amount, timestamp) VALUES (?, ?, ?, ?)`,
    params: [account.address, txHash, DRIP_AMOUNT, timestamp],
  }))

  db.run(`BEGIN TRANSACTION`)
  let txErr = null
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i]
    try {
      await db.run(op.query, op.params)
    } catch (err) {
      txErr = err
      break
    }
  }

  if (!txErr) {
    try {
      await daemon.submitTransaction(txHex)
    } catch (err) {
      txErr = err
    }
  }

  db.run(txErr ? `ROLLBACK` : `COMMIT`)

  accounts.forEach((account) => {
    sessions.delete(account.sessionId)
  })
}

setInterval(sendTransactions, SEND_INTERVAL)

app.listen(port, hostname, () => {
  console.log(`Server is running on http://${hostname}:${port}`)
})