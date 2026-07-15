import { Product } from "../types/product";

const DB_LATENCY_MS = 2000;

const products: Product[] = [
  { id: 1, name: "Wireless Mouse", price: 25.0 },
  { id: 2, name: "Mechanical Keyboard", price: 89.0 },
  { id: 3, name: "USB-C Hub", price: 34.5 },
];

const delay = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

let callCount = 0;
const getProductById = async (id: number) => {
  callCount++;
  console.log(`DB CALL #${callCount} for product ${id}`);
  await delay(DB_LATENCY_MS);

  const product = products[id];

  return product ? { ...product } : null;
};

const updateDirectly = async (id: number, changes: Product) => {
  await delay(DB_LATENCY_MS);

  const product = products[id];

  if (!product) throw new Error("Product does not exist");

  products[id] = {
    ...product,
    ...changes,
  };

  return { ...products[id] };
};

export const DB_Product = {
  getProductById,
  updateDirectly,
};
