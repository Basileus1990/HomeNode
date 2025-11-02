export enum ErrorCodes {
    UnknownError = 0,
    ConnectionClosed = 1,
    Timeout = 2,
    HostNotFound = 3,
    InvalidUrlParams = 4,
    InvalidMessageBody = 5,
    UnexpectedMessageType = 6,
    MissingRequiredParams = 7,
    HostAlreadyConnected = 8,
    InvalidHostKey = 9,

    ResourceNotFound = 10,
    OperationNotAllowed = 11,
    InvalidPath = 13,
    OperationForbidden = 14,
}