# XELIS Faucet

A simple page to interact with the faucet API.
Users can input a wallet address, answer the captha and receive dust.

Testnet: <https://testnet-faucet.xelis.io>  

## Development

For development this app uses the `g45-react` package to bundle and serve app.
Simply run `npm start` to build, start the dev server and watch modified files automatically.
For environment variables, it will create a `bundler-define.json` file and check in the `env` folder.  

## Production

The app is served by cloudflare and uses `cf_build.sh` to build from a specific branch.
Pushing branch `testnet-pages` or `mainnet-pages` will automatically build and deploy to cloudflare.

To build for nodejs run `npm run build-prod:node`.
