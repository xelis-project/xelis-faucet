import { useServerData } from 'g45-react/hooks/useServerData'
import Age from 'g45-react/components/age'
import { formatXelis } from 'xelis-explorer/src/utils'
import { useLang } from 'g45-react/hooks/useLang'

import style from './style'
import { callApi } from './call_api'

export function loadStats_SSR() {
  const defaultResult = { err: null, stats: {} }
  return useServerData(`stats`, async () => {
    const result = Object.assign({}, defaultResult)

    try {
      const stats = await callApi(`/stats`)
      result.stats = stats
    } catch (err) {
      result.err = err
    }

    return result
  }, defaultResult)
}

function Stats(props) {
  const { statsResult } = props

  const { t } = useLang()

  const { stats } = statsResult

  return <div className={style.stats.container}>
    <StatItem title={t(`Drips`)} value={stats.drips || 0} />
    <StatItem title={t(`Total Sent`)} value={formatXelis(stats.total_sent || 0)} />
    <StatItem title={t(`Unique Accounts`)} value={stats.unique_accounts || 0} />
    <StatItem title={t(`Last Drip`)} value={stats.last_drip ? <Age timestamp={stats.last_drip} /> : `?`} />
    <StatItem title={t(`Drip Pool`)} value={stats.session_count || 0} />
  </div>
}

function StatItem(props) {
  const { title, value } = props

  return <div className={style.stats.item.container}>
    <div className={style.stats.item.title}>{title}</div>
    <div className={style.stats.item.value}>{value}</div>
  </div>
}

export default Stats