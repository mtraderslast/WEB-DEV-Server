const globalErrorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Something went wrong!";

    if (err.name === "ValidationError") {
        statusCode = 400;
        message = Object.values(err.errors || {}).map((item) => item.message).join(", ") || "Invalid data";
    }

    if (err.name === "CastError") {
        statusCode = 400;
        message = "Invalid ID";
    }

    if (err.code === 11000) {
        statusCode = 409;
        message = "This record already exists";
    }

    res.status(statusCode).json({
        success: false,
        message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
};

export default globalErrorHandler;
