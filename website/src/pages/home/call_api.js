export async function callApi(endpoint, params) {
  const res = await fetch(`${FAUCET_ENDPOINT}${endpoint}`, {
    method: `POST`,
    body: JSON.stringify(params),
    headers: {
      'Content-Type': 'application/json'
    }
  })

  const data = await res.json()
  if (data.error) {
    throw data.error
  }

  return data
}
