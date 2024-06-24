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
const CONFIG_PORT = parseInt(process.env.PORT)
const CONFIG_HOSTNAME = process.env.HOSTNAME
const CONFIG_ADDR_PREFIX = process.env.ADDR_PREFIX

app.use(bodyParser.json())

const dbLocation = process.env.DB_LOCATION
const db = await open({
  filename: dbLocation,
  driver: sqlite3.Database
})

const CONFIG_DRIP_COOLDOWN_MS = parseInt(process.env.DRIP_COOLDOWN_MS)
const CONFIG_DRIP_AMOUNT_ATOMIC = parseInt(process.env.DRIP_AMOUNT_ATOMIC)
const CONFIG_SEND_INTERVAL_MS = parseInt(process.env.SEND_INTERVAL_MS)
const CONFIG_MAX_CAPTCHA_TRIES = parseInt(process.env.MAX_CAPTCHA_TRIES)

const CONFIG_USE_CORS = process.env.USE_CORS || 'false'
const CONFIG_IP_MAX_REQUESTS = parseInt(process.env.IP_MAX_REQUESTS)
const CONFIG_IP_COOLDOWN_MS = parseInt(process.env.IP_COOLDOWN_MS)

const CONFIG_DAEMON_ENDPOINT = process.env.DAEMON_ENDPOINT
const daemon = new DaemonRPC(CONFIG_DAEMON_ENDPOINT)

const info = await daemon.getInfo()
console.log(`Successful daemon fetch at ${CONFIG_DAEMON_ENDPOINT}.`)

const CONFIG_WALLET_ENDPOINT = process.env.WALLET_ENDPOINT
const CONFIG_WALLET_USERNAME = process.env.WALLET_USERNAME
const CONFIG_WALLET_PASSWORD = process.env.WALLET_PASSWORD
const wallet = new WalletRPC(CONFIG_WALLET_ENDPOINT, CONFIG_WALLET_USERNAME, CONFIG_WALLET_PASSWORD)

const res = await wallet.getAddress()
console.log(`Successful wallet fetch ${res.result} at ${CONFIG_WALLET_ENDPOINT}.`)

const sessions = new Map() // address, solution, tries, valid
const ips = new Map() // count, timestamp

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

if (CONFIG_USE_CORS.toLowerCase() === 'true') {
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
    res.status(200).send({
      ...row,
      session_count: sessions.size,
      drip_amount: CONFIG_DRIP_AMOUNT_ATOMIC,
      drip_cooldown: CONFIG_DRIP_COOLDOWN_MS,
    })
  } catch (err) {
    resError(res, err)
  }
})

app.post('/txs', async (req, res) => {
  try {
    const page = parseInt(req.body.page) || 1
    const size = parseInt(req.body.size) || 30

    const offset = (page - 1) * size

    const rows = await db.all(`
      SELECT * 
      FROM transactions 
      ORDER BY timestamp DESC LIMIT ? OFFSET ?
    `, [size, offset])
    res.status(200).send(rows)
  } catch (err) {
    resError(res, err)
  }
})

app.post('/request-drip', async (req, res) => {
  const { address } = req.body
  const timestamp = Date.now()

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  if (ipLimitReached(ip)) {
    resError(res, new Error(`Max requests exceeded. IP banned temporarily.`))
    return
  }

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

  let lastTx = null
  try {
    lastTx = await db.get(`
      SELECT * 
      FROM transactions 
      WHERE address = ? 
      ORDER BY timestamp DESC LIMIT 1
    `, [address])
  } catch (err) {
    resError(res, err)
    return
  }


  if (lastTx && timestamp - lastTx.timestamp < CONFIG_DRIP_COOLDOWN_MS) {
    resError(res, new Error(`This address is in cooldown.`))
    return
  }

  // using svg captcha and ip limiting to avoid bots
  // maybe you can train an AI on opentype font, match svg letter paths and bypass the captcha?
  // we might have to find another solution / alternative for production faucet

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

    if (session.tries > CONFIG_MAX_CAPTCHA_TRIES) {
      sessions.delete(sessionId)
      resError(res, new Error(`Maximum number of attempts reached for sending a valid captcha.`))
      return
    }

    sessions.set(sessionId, session)
    resError(res, new Error(`The captcha id is invalid.`))
    return
  }


  if (!session.address.startsWith(CONFIG_ADDR_PREFIX)) {
    sessions.delete(sessionId)
    resError(res, new Error(`The address does not starts with ${CONFIG_ADDR_PREFIX}.`))
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
      resError(res, new Error(`The address is not a valid.`))
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

function ipLimitReached(ip) {
  const ipCheck = ips.get(ip)
  const timestamp = Date.now()

  if (ipCheck) {
    if (timestamp - ipCheck.timestamp > CONFIG_IP_COOLDOWN_MS) {
      ips.set(ip, { timestamp, count: 1 })
    } else {
      ipCheck.count++
      ipCheck.timestamp = timestamp
  
      if (ipCheck.count > CONFIG_IP_MAX_REQUESTS) {
        return true
      } else {
        ips.set(ip, ipCheck)
      }
    }
  } else {
    ips.set(ip, { timestamp, count: 1 })
  }

  return false
}

async function sendTransactions() {
  const accounts = []

  for (const [id, session] of sessions) {
    const { valid, address } = session
    if (valid) {
      accounts.push({ address, sessionId: id })
    }
  }

  if (accounts.length === 0) return
  const timestamp = Date.now()
  const total = accounts.length * CONFIG_DRIP_AMOUNT_ATOMIC

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
      amount: CONFIG_DRIP_AMOUNT_ATOMIC,
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
    query: `
      INSERT INTO transactions (address, tx_hash, amount, timestamp) 
      VALUES (?, ?, ?, ?)
    `,
    params: [account.address, txHash, CONFIG_DRIP_AMOUNT_ATOMIC, timestamp],
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

setInterval(sendTransactions, CONFIG_SEND_INTERVAL_MS)

app.listen(CONFIG_PORT, CONFIG_HOSTNAME, () => {
  console.log(`Server is running on http://${CONFIG_HOSTNAME}:${CONFIG_PORT}`)
})