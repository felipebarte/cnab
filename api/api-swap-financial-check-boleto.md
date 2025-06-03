# Check Boleto
## Use this endpoint to check the information of a specific boleto. After you check the boleto, you can pay it using the Pay Boleto endpoint.Base URLs

https://api-stag.contaswap.io (STG)
https://api-prod.contaswap.io (PROD)

Method: POST

Path: /ledger/payments/boletos

curl --location 'https://api-prod.contaswap.io/ledger/payments/boletos' \
--header 'Authorization: Bearer <access_token>' \
--header 'Content-Type: application/json' \
--data '{
  "barcode": "65590000020044250000522980944007184030000018000"
}'

Response:
{
  "amount": 18000,
  "authentication": "5100",
  "authentication_api": {
    "Bloco1": "B7.42.0B.AC.98.E2.2A.D7",
    "Bloco2": "36.B4.93.6F.60.30.44.75",
    "BlocoCompleto": "B7.42.0B.AC.98.E2.2A.D7.36.B4.93.6F.60.30.44.75"
  },
  "barcode": "65590000020044250000522980944007184030000018000",
  "canceled_at": null,
  "client_id": "0f1d554c-0bb8-11ea-8d71-362b9e155669",
  "confirmed_at": null,
  "discount_amount": null,
  "due_date": "2020-10-09",
  "end_hour": "23:00:00",
  "final_payment_date": "2020-10-09",
  "fine_amount": null,
  "id": "94c6e336-8940-4a12-bd21-dc253867ac59",
  "inserted_at": "2020-08-31T20:21:27",
  "interest_amount": null,
  "issuer": "BANCO VOTORANTIM S.A.",
  "max_amount": 18000,
  "min_amount": 18000,
  "payee": "BENEFICIARIO AMBIENTE HOMOLOGACAO",
  "payee_document": "21.568.259/0001-00",
  "payer": "PAGADOR AMBIENTE HOMOLOGACAO",
  "payer_document": "96.906.497/0001-00",
  "receipt": null,
  "settle_date": "2020-08-31",
  "start_hour": "07:00:00",
  "status": "pending_payment",
  "type": "generic",
  "updated_amount": 18000,
  "updated_at": "2020-08-31T20:21:27",
  "allow_change_value": true
}


## Boleto type
### There are two types of boleto: utility_bill or generic

## Utility bills have all the boleto information included in the barcode itself, so the check response will include less information. They never have discounts, fines, or interests and the payment amount cannot be changed.

## Generic boletos are registered at CIP (a Brazilian clearing house infrastructure) and the check response can contain more information. Generic boletos can have discounts, fines, or interest applied and the payment amount can vary between the min_amount and max_amount range.

## Minimum and maximum amount
### For some generic boletos, the payer can choose a payment amount within a specified range. To determine if this option is available, check the amount_change field in the response payload.

## If both values are the same, the payment amount for the boleto cannot be changed.

## Fees, discount, and interest amount
### A generic boleto (registered at CIP) can have a discount, or interest and fees applied to its original value. The final payment amount is informed in the updated_amount field. You must show this information to the payer.

## Start and end time
### A boleto can only be paid on the same business day before the end_hour. After that, the boleto can only be paid on the next business day. If the boleto is being paid at the due date, it should be paid before the end_hour, otherwise it may generate fees and interests to the payer.

## Payee
### The payee field will inform the name of the beneficiary of the boleto. The payer must validate this information to avoid fraud.

201
Object
Created Successfully
Response Attributes
amount
integer
The amount that will be paid with the boleto, in cents. The data type must be BigInteger.

authentication
string
The payment authentication number, used as payment receipt.

authentication_api
object
An object containing the payment authentication number of the API. This information can also be used as a payment receipt.

Hide child attributes

Bloco1
string
The first block of the authentication number.

Bloco2
string
The second block of the authentication number.

BlocoCompleto
string
The complete authentication number.

barcode
string
The serial number of the barcode.

canceled_at
string
If the boleto was canceled before payment, this will be the timestamp of when the cancellation occurred.

client_id
string
Your unique identifier at Swap.

confirmed_at
string
The date when the payment was confirmed.

discount_amount
integer
The amount of the discount, if applied. The data type must be BigInteger.

due_date
string
The date by which the boleto must be paid, in "yyyy-MM-dd" format.

end_hour
string
The time limit that the boleto can be paid, in "HH:mm:ss" format. After that, the boleto will be paid on the next business day.

final_payment_date
string
The date by when the final payment must be made, in "yyyy-MM-dd" format.

fine_amount
integer
The amount of the fine, if applied.

id
string
The unique identifier of the boleto.

inserted_at
string
The time when the boleto record was inserted at CIP (Câmara Interbancária de Pagamentos), in "yyyy-MM-ddTHH:mm:ss" format.

interest_amount
integer
The amount of interest, if applied.The data type must be BigInteger.

issuer
string
The issuer institution of the boleto.

max_amount
integer
The maximum payment amount, in cents. The data type must be BigInteger.

min_amount
integer
The minimum payment amount, in cents.The data type must be BigInteger.

payee
string
The name of the person or business receiving the payment.

payee_document
string
The document of the payee (CPF or CNPJ), if registered at CIP.

payer
string
The name of the person or business responsible for paying the boleto.

payer_document
string
The document of the payer (CPF or CNPJ), if registered at CIP.

receipt
string
The text that will appear on the receipt.

settle_date
string
The date when the boleto will be settled, in "yyyy-MM-dd" format.

start_hour
string
The first business hour when the boleto can be paid on the same day it was created, in "HH:mm:ss" format.

status
string
The status of the payment.

type
string
The type of boleto. Possible values: "generic" and "utility_bill"

updated_amount
number
The updated amount if discounts, fines, or interest were applied. The data type must be BigInteger.

updated_at
string
The date when the boleto was last updated.

allow_change_value
boolean
Indicates whether changes to the payment amount are allowed.

422
Object
Business Rule Error: out of business hours
Response Attributes
error_reason
string
error_type
string
422
Object
Business Impossibility Error: boleto already paid
Response Attributes
error_reason
string
error_type
string
503
Object
Service Unavailable
Response Attributes
error_reason
string
error_type
string
504
Object
Timout Error