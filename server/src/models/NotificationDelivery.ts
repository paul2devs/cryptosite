import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";

/**
 * Delivery ledger for outbound notification channels (currently email).
 *
 * A single row exists per stable `idempotency_key`, so a retry or a concurrent
 * background job can never deliver the same notification twice: the unique key
 * makes the first writer the owner of the send, and every later attempt is
 * rejected while the delivery is `sent`. A delivery that failed is left in
 * `failed` so a safe retry can pick it up without ever duplicating a delivery
 * that already succeeded.
 */
export type NotificationDeliveryStatus = "sending" | "sent" | "failed" | "skipped";

export interface NotificationDeliveryAttributes {
  delivery_id: string;
  idempotency_key: string;
  channel: string;
  user_id: string | null;
  notification_type: string | null;
  status: NotificationDeliveryStatus;
  attempts: number;
  last_error: string | null;
  sent_at: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export type NotificationDeliveryCreationAttributes = Optional<
  NotificationDeliveryAttributes,
  "delivery_id" | "user_id" | "notification_type" | "status" | "attempts" | "last_error" | "sent_at" | "created_at" | "updated_at"
>;

export class NotificationDelivery
  extends Model<NotificationDeliveryAttributes, NotificationDeliveryCreationAttributes>
  implements NotificationDeliveryAttributes
{
  public delivery_id!: string;
  public idempotency_key!: string;
  public channel!: string;
  public user_id!: string | null;
  public notification_type!: string | null;
  public status!: NotificationDeliveryStatus;
  public attempts!: number;
  public last_error!: string | null;
  public sent_at!: Date | null;
  public created_at!: Date;
  public updated_at!: Date;
}

NotificationDelivery.init(
  {
    delivery_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    idempotency_key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    channel: {
      type: DataTypes.STRING,
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    notification_type: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "sending"
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    last_error: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: "notification_deliveries",
    timestamps: false,
    indexes: [{ fields: ["idempotency_key"], unique: true }, { fields: ["user_id"] }]
  }
);

NotificationDelivery.belongsTo(User, { foreignKey: "user_id" });
