########################
# Frontend build stage #
########################
FROM node:20-alpine AS frontend

WORKDIR /app

COPY ./frontend/package.json ./
COPY ./frontend/package-lock.json ./

ENV VITE_CONFIG_ENDPOINT=/api/v1/config

RUN npm ci

COPY ./frontend/ ./

RUN npm run build

#######################
# Backend build stage #
#######################
FROM golang:1.23-alpine AS backend

ENV CGO_ENABLED=1

WORKDIR /app

RUN apk add --no-cache gcc musl-dev

COPY ./backend/go.mod ./backend/go.sum ./
RUN go mod download

COPY ./backend ./

RUN go build -o main .

#################
# Runtime stage #
#################
FROM alpine:3.20

WORKDIR /app/backend

COPY --from=backend /app/main ./main
COPY --from=backend /app/migrations ./migrations
COPY --from=frontend /app/build ../frontend/build

EXPOSE 3000

CMD ["./main"]
