import { useCallback, useEffect, useState } from 'react'
import Table from 'xelis-explorer/src/components/table'
import { reduceText, formatXelis } from 'xelis-explorer/src/utils'
import { useLang } from 'g45-react/hooks/useLang'

import style from './style'
import { callApi } from './call_api'

function Transactions() {
  const { t } = useLang()

  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState()

  const loadTxs = useCallback(async () => {
    try {
      setLoading(true)
      const result = await callApi(`/txs`)
      setTxs(result)
      setLoading(false)
    } catch (err) {
      console.log(err)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTxs()
  }, [])

  return <div>
    <div className={style.title}>
      {t(`Drips`)}
    </div>
    <Table emptyText={t(`No drips yet`)}
      headers={[t(`Timestamp`), t(`Hash`), t(`Account`), t(`Amount`)]}
      list={txs} loading={loading} colSpan={4} onItem={(item) => {
        const { id, address, tx_hash, amount, timestamp } = item
        return <tr key={id}>
          <td>{new Date(timestamp).toLocaleString()}</td>
          <td>
            <a href={`${EXPLORER_LINK}/blocks/${tx_hash}`} target="_blank">
              {reduceText(tx_hash)}
            </a>
          </td>
          <td>
            <a href={`${EXPLORER_LINK}/accounts/${address}`} target="_blank">
              {reduceText(address, 0, 7)}
            </a>
          </td>
          <td>{formatXelis(amount)}</td>
        </tr>
      }} />
  </div>
}

export default Transactions