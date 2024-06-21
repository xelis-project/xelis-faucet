import { Outlet } from 'react-router'
import Background from 'xelis-explorer/src/layout/background'
import { css } from 'goober'

import layoutStyle from 'xelis-explorer/src/style/layout'

const style = {
  container: css`
    padding-bottom: 5em;
  `
}

function Layout() {
  return <div className={layoutStyle.container}>
    <Background />
    <div className={layoutStyle.pageFlex}>
      <div className={layoutStyle.pageMaxWidth}>
        <div className={style.container}>
          <Outlet />
        </div>
      </div>
    </div>
  </div>
}

export default Layout
