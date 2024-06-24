import { css } from 'goober'
import theme from 'xelis-explorer/src/style/theme'
import { logoBgUrl } from 'xelis-explorer/src/layout/header'

export default {
  header: {
    container: css`
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 2em 0 3em 0;
      gap: 1em;
    `,
    logo: css`
      width: 3em;
      height: 3em;
      display: block;
      background-size: contain;
      background-repeat: no-repeat;
      background-image: ${logoBgUrl};
    `,
    title: css`
      font-size: 2.5em;
      font-weight: bold;
    `,
    description: css`
      max-width: 27em;
      text-align: center;
      opacity: .9;
    `
  },
  faucet: {
    container: css`
      display: flex;
      gap: 1em;
      flex-direction: column;
      margin: 0 auto;
      max-width: 1000px;
      margin-bottom: 2em;

      ${theme.query.minDesktop} {
        flex-direction: row;
      }

      input {
        padding: .6em 1em;
        border-radius: 1em;
        border: transparent;
        outline: none;
        font-size: 1.3em;
        flex: 1;
      }
      
      button {
        padding: .6em 1em;
        border-radius: 1em;
        font-size: 1.3em;
        background: #0c0c0c;
        border: none;
        cursor: pointer;
        color: white;
        display: flex;
        align-items: center;
        gap: .5em;
        transition: .25s all;

        &:hover {
          transform: scale(.95);
        }
      }
    `
  },
  title: css`
    font-size: 1.5em;
    margin-bottom: .5em;
  `,
  dripDetails: {
    container: css`
      display: flex;
      gap: 2em;
      margin-bottom: 3em;
      justify-content: center;
    `,
    item: css`
      display: flex;
      gap: .5em;
      align-items: center;
      flex-direction: column;
    `,
    title: css`
      color: var(--muted-color);
    `,
    value: css`
      font-size: 2em;
      font-weight: bold;
    `
  },
  stats: {
    container: css`
      background: linear-gradient(to right, rgb(0 0 0 / 40%), transparent);
      padding: 2em;
      margin-bottom: 2em;
      border-radius: 1em;
      color: var(--text-color);
      display: flex;
      flex-direction: column;
      gap: 2em;

      ${theme.query.minDesktop} {
        flex-direction: row;
        gap: 5em;
      }
    `,
    item: {
      container: css`
        display: flex;
        gap: .3em;
        flex-direction: column;
      `,
      title: css`
        font-size: 1.1em;
        opacity: .6;
        white-space: nowrap;
        margin-bottom: .1em;
      `,
      value: css`
        font-size: 1.6em;
        white-space: nowrap;
      `
    },
  },
  captcha: {
    container: css`
      padding: 2em;
      background: black;
      border-radius: 1em;
      max-width: 350px;
      gap: 1em;
      display: flex;
      flex-direction: column;

      svg {
        width: 100%;
        height: 150px;
        background: white;
        border-radius: 1em;
      }

      input {
        padding: .6em 1em;
        border-radius: 1em;
        border: transparent;
        outline: none;
        font-size: 1.3em;
        width: 100%;
      }
      
      button {
        padding: .6em 1em;
        border-radius: 1em;
        font-size: 1.3em;
        background: #353535;
        border: none;
        cursor: pointer;
        color: white;
        display: flex;
        align-items: center;
        gap: .5em;
        transition: .25s all;

        &:hover {
          transform: scale(.95);
        }
      }
    `,
    title: css`
      font-size: 1.5em;
    `,
  },
  confirmed: {
    container: css`
      padding: 2em;
      background: black;
      border-radius: 1em;
      max-width: 350px;
      gap: 1em;
      display: flex;
      flex-direction: column;
      align-items: center;
    `,
    icon: css`
      font-size: 3em;
      padding: .25em;
    `,
    msg: css`
      font-size: 1.2em;
      text-align: center;
    `
  }
}
