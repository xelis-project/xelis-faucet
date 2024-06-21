import App from 'xelis-explorer/src/app'
import NotFound from 'xelis-explorer/src/pages/notFound'

import Layout from './layout/layout'
import Home from './pages/home/index'

const routes = [
  {
    element: <App title="XELIS Faucet" />,
    children: [
      {
        element: <Layout />,
        children: [
          {
            path: '/',
            element: <Home />,
          },
          {
            path: `*`,
            element: <NotFound />
          }
        ]
      }
    ]
  }
]

export default routes
