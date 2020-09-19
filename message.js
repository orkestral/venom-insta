const errorCode = {
    "1": "Wrong password!",
    "2": "This post couldn't be found!"
}
const errorTemplate = (code) => {
    return {
        "error": {
            code,
            message: errorCode[code]
        }
    }
}
const errorMessage = {
    "wrongPassword": errorTemplate(1),
    "postNotFound": errorTemplate(2)
}

module.exports = { errorMessage }