import { useLang } from 'g45-react/hooks/useLang'
import { useCallback, useMemo, useState } from 'react'
import Modal from 'xelis-explorer/src/components/modal'
import { Helmet } from 'react-helmet-async'
import Icon from 'g45-react/components/fontawesome_icon'
import { formatXelis } from 'xelis-explorer/src/utils'
import prettyMS from 'pretty-ms'

import Transactions from './txs'
import Stats, { loadStats_SSR } from './stats'
import style from './style'
import { callApi } from './call_api'

function Home() {
  const { t } = useLang()

  const description = useMemo(() => {
    return t(`Use this faucet to receive dust in your wallet and try out dApps across the entire ecosystem.`)
  }, [t])

  const [captchaModalVisible, setCaptchaModalVisible] = useState()
  const [captchaSession, setCaptchaSession] = useState()

  const statsResult = loadStats_SSR()

  return <div>
    <Helmet>
      <title>{t(`Home`)}</title>
      <meta name="description" content={description} />
    </Helmet>
    <div className={style.header.container}>
      <div className={style.header.logo}></div>
      <h1 className={style.header.title}>XELIS Faucet</h1>
      <div className={style.header.description}>{description}</div>
    </div>
    <DripDetails statsResult={statsResult} />
    <AddrForm setCaptchaModalVisible={setCaptchaModalVisible} setCaptchaSession={setCaptchaSession} />
    <Stats statsResult={statsResult} />
    <Transactions />
    <Modal visible={captchaModalVisible} setVisible={setCaptchaModalVisible}>
      <SolveCaptcha captchaSession={captchaSession} />
    </Modal>
  </div>
}

function DripDetails(props) {
  const { statsResult } = props
  
  const { t } = useLang()

  const { stats } = statsResult

  return <div className={style.dripDetails.container}>
    <div className={style.dripDetails.item}>
      <div className={style.dripDetails.title}>{t(`Drip Amount`)}</div>
      <div className={style.dripDetails.value}>{formatXelis(stats.drip_amount || 0)}</div>
    </div>
    <div className={style.dripDetails.item}>
      <div className={style.dripDetails.title}>{t(`Drip Cooldown`)}</div>
      <div className={style.dripDetails.value}>{prettyMS(stats.drip_cooldown || 0)}</div>
    </div>
  </div>
}

function AddrForm(props) {
  const { setCaptchaModalVisible, setCaptchaSession } = props

  const { t } = useLang()
  const [loading, setLoading] = useState()

  const requestDrip = useCallback(async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const address = formData.get(`address`)
    if (!address) return

    setLoading(true)
    try {
      const result = await callApi(`/request-drip`, { address })
      setCaptchaSession(result)
      setCaptchaModalVisible(true)
      setLoading(false)
    } catch (err) {
      console.log(err)
      setLoading(false)
      window.alert(JSON.stringify(err))
    }
  }, [])

  return <form className={style.faucet.container} onSubmit={requestDrip}>
    <input type="text" name="address" placeholder={t(`Enter your wallet address`)}
      autoCapitalize="off" autoComplete="off"
    />
    <button type="submit">
      {loading ? <Icon name="circle-notch" className="fa-spin" /> : <Icon name="faucet-drip" />}
      {t(`Use`)}
    </button>
  </form>
}


function SolveCaptcha(props) {
  const { captchaSession } = props

  const { t } = useLang()

  const [loading, setLoading] = useState()
  const [err, setErr] = useState()
  const [captchaSolution, setCaptchaSolution] = useState(``)
  const [confirmed, setConfirmed] = useState()

  const confirmDrip = useCallback(async (e) => {
    e.preventDefault()

    const formData = new FormData(e.target)
    const solution = formData.get(`solution`)
    if (!solution) return

    setLoading(true)
    setErr(null)
    try {
      const { sessionId } = captchaSession
      await callApi(`/confirm-drip`, { sessionId, solution })
      setLoading(false)
      setConfirmed(true)
    } catch (err) {
      console.log(err)
      setLoading(false)
      setErr(err)
      setCaptchaSolution(``)
    }
  }, [captchaSession])

  if (confirmed) {
    return <div className={style.confirmed.container}>
      <Icon name="check" className={style.confirmed.icon} />
      <div className={style.confirmed.msg}>
        {t(`The faucet was opened successfully. You should receive funds momentarily.`)}
      </div>
    </div>
  }

  return <form className={style.captcha.container} onSubmit={confirmDrip}>
    <div className={style.captcha.title}>Solve the captcha!</div>
    <div dangerouslySetInnerHTML={{ __html: captchaSession.captcha }} />
    <input type="text" name="solution" placeholder="Enter captcha solution"
      value={captchaSolution} onChange={(e) => setCaptchaSolution(e.target.value)}
      autoCapitalize="off" autoComplete="off"
    />
    <button type="submit">
      {loading ? <Icon name="circle-notch" className="fa-spin" /> : <Icon name="paper-plane" />}
      {t(`Submit`)}
    </button>
    {err && <div>{JSON.stringify(err)}</div>}
  </form>
}

export default Home