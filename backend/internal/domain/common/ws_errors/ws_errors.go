package ws_errors

type WebsocketError struct {
	msg  string
	code WebsocketErrorCode
}

func (w WebsocketError) Error() string {
	return w.msg
}

func (w WebsocketError) Code() WebsocketErrorCode {
	return w.code
}

var ConnectionClosedErr = WebsocketError{
	msg:  "connection closed",
	code: ConnectionClosed,
}

var HostNotFoundErr = WebsocketError{
	msg:  "host not found",
	code: HostNotFound,
}

var TimeoutErr = WebsocketError{
	msg:  "timeout",
	code: Timeout,
}
