/**
 * Kafka Client Setup for Fulfillment Service
 * 
 * Consumes order/payment events and produces fulfillment lifecycle events.
 */

import { createKafkaClient, createConsumer, createProducer } from "@innovabound-ecomm-platform/kafka-client";
import { config } from "../config/index.js";

const kafkaClient = createKafkaClient(config.kafka.clientId);

export const producer = createProducer(kafkaClient);
export const consumer = createConsumer(kafkaClient, config.kafka.groupId);
