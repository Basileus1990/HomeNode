package ws_errors

type WebsocketError struct {
	code WebsocketErrorCode
	msg  string
}

func (w WebsocketError) Error() string {
	return w.msg
}

func (w WebsocketError) Code() WebsocketErrorCode {
	return w.code
}

var ConnectionClosedErr = WebsocketError{
	code: ConnectionClosed,
	msg:  "connection closed error",
}

var HostNotFoundErr = WebsocketError{
	code: HostNotFound,
	msg:  "host not found error",
}

var TimeoutErr = WebsocketError{
	code: Timeout,
	msg:  "timeout error",
}

var InvalidMessageBodyErr = WebsocketError{
	code: InvalidMessageBody,
	msg:  "invalid message body error",
}

var UnexpectedMessageTypeErr = WebsocketError{
	code: UnexpectedMessageType,
	msg:  "unexpected message type error",
}

var HostAlreadyConnectedErr = WebsocketError{
	code: HostAlreadyConnected,
	msg:  "host already connected",
}

var InvalidHostKeyErr = WebsocketError{
	code: InvalidHostKey,
	msg:  "invalid host key error",
}
