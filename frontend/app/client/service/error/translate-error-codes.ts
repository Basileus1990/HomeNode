import { ErrorCodes } from "~/common/error-codes";


export function getErrorMessage(code: ErrorCodes): string {
    switch (code) {
        case ErrorCodes.UnknownError:
            return "An unknown error occurred.";
        case ErrorCodes.ConnectionClosed:
            return "The connection was closed unexpectedly.";
        case ErrorCodes.Timeout:
            return "The operation timed out.";
        case ErrorCodes.HostNotFound:
            return "Host not found.";
        case ErrorCodes.InvalidUrlParams:
            return "Invalid URL parameters.";
        case ErrorCodes.InvalidMessageBody:
            return "Invalid message body.";
        case ErrorCodes.UnexpectedMessageType:
            return "Unexpected message type received.";
        case ErrorCodes.MissingRequiredParams:
            return "Missing required parameters.";
        case ErrorCodes.HostAlreadyConnected:
            return "Host is already connected.";
        case ErrorCodes.InvalidHostKey:
            return "Invalid host key provided.";
        case ErrorCodes.ResourceNotFound:
            return "Requested resource was not found.";
        case ErrorCodes.OperationNotAllowed:
            return "Operation not allowed.";
        case ErrorCodes.InvalidPath:
            return "Invalid path specified.";
        default:
            return "Unknown error code.";
    }
}