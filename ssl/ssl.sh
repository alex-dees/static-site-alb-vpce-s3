# $1 = domain name

rm -f *.pem *.conf *.txt

cat > req.conf <<EOF
[req]
prompt = no
distinguished_name = dn

[dn]
C = US
ST = MO
L = "Saint Louis"
O = Acme
OU = IT
CN = $1
EOF

openssl req \
-config req.conf \
-x509 -days 365 \
-nodes -newkey rsa:2048 \
-out cert.pem -keyout key.pem 

arn=$(aws acm import-certificate \
--certificate fileb://cert.pem \
--private-key fileb://key.pem \
--query 'CertificateArn' \
--output text)

# set cert arn in cdk.json
sed -i "s|.*cert.*|      \"cert\": \"$arn\"|g" ../cdk.json