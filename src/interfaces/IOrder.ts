export interface IOrder {
  id: number;
  status: "pending" | "shipped";
  trackingNumber?: string;
}
