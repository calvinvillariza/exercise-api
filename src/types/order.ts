type Order =
  | { status: "pending"; id: number }
  | { status: "shipped"; id: number; trackingNumber: string };

export { Order };
