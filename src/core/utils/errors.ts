export class SessionExpiredError extends Error {
    constructor(msg: string = "Session has expired") {
        super(msg);
        this.name = "SessionExpiredError";
    }
}