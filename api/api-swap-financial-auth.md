# Request Authorization Token
Use this endpoint to request the authentication token that will be used when you send an API request.

### Request
curl --location --globoff 'https://api-prod.contaswap.io/auth/{client_id}/token' \
--header 'Content-Type: application/json' \
--header 'x-api-key: <YOUR_X_APY_KEY>' \
--data '{
  "grant_type": "client_credentials",
  "client_id": "<YOUR_CLIENT_ID>",
  "client_secret": "<YOUR_CLIENT_CREDENTIALS>"
}'

### Response
{
  "access_token": "<ACCESS_TOKEN>",
  "expires_in": 300,
  "refresh_expires_in": 1800,
  "refresh_token": "<REFRESH_TOKEN>",
  "token_type": "bearer"
}

Base URLs
https://api.staging.swapcards.com.br/beta_v3 (STG)
https://api.swapcards.com.br/beta_v3 (PROD)

Method: POST

Path: /auth/{client_id}/token

Header Parameters
Content-Type
string
Required
The type of content accepted. Allowed value: application/json

x-api-key
string
Required
Your x-api-key provided by Swap.

Path Parameters
client_id
string
Required
The client_id as informed by Swap.

Body Parameters
grant_type
string
Required
The type of grant used.

Default value
client_credentials
client_id
string
Required
The client_id provided by Swap.

client_secret
string
Required
The "secret" you received from the Retrieve Client information endpoint.

Response
200
Object
Response Attributes
access_token
string
The access token that you will use in the Authorization filed in the header of all endpoints.

expires_in
integer
How long it will take for the token to expire.

refresh_expires_in
integer
How long it will take for the refresh token to expire.

refresh_token
string
The refresh token that you can use to authenticate.

token_type
string
The type of token.

400
Object