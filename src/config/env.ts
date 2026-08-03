import dotenv from "dotenv";

dotenv.config();

const parsePort = (value: string | undefined): number => {
  const port = Number(value ?? 3000);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: "${value}"`);
  }

  return port;
};

export const PORT = parsePort(process.env.PORT);
export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const IS_PRODUCTION = NODE_ENV === "production";
