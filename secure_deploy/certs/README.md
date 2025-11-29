To create test keys use:
```sh
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./key.pem -out ./cert.pem
```
