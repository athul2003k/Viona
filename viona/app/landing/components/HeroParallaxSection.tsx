"use client";
import React from "react";
import { HeroParallax } from "@/components/ui/hero-parallax";

export const products = [
  {
    title: "Inventory Management",
    link: "#",
    thumbnail: "/hero/inventory.png",
  },
  {
    title: "Analytics Dashboard",
    link: "#",
    thumbnail: "/hero/dashboard.png",
  },
  {
    title: "AI Workflow Builder",
    link: "#",
    thumbnail: "/hero/workflow.jpeg",
  },
  {
    title: "Automation Assistant",
    link: "#",
    thumbnail: "/hero/chat.jpeg",
  },
  {
    title: "Order Fulfillment",
    link: "#",
    thumbnail: "/hero/orders.png",
  },
  {
    title: "Secure Credentials",
    link: "#",
    thumbnail: "/hero/credentails.jpeg",
  },
  {
    title: "Cloud Storage",
    link: "#",
    thumbnail: "/hero/storage.png",
  },
  {
    title: "Warehouse Management",
    link: "#",
    thumbnail: "/hero/warehouse.png",
  },
  {
    title: "Stock Optimization",
    link: "#",
    thumbnail: "/hero/inventory.png",
  },
  {
    title: "Revenue Tracking",
    link: "#",
    thumbnail: "/hero/dashboard.png",
  },
  {
    title: "Custom Flows",
    link: "#",
    thumbnail: "/hero/workflow.jpeg",
  },
  {
    title: "Autonomous Agents",
    link: "#",
    thumbnail: "/hero/chat.jpeg",
  },
  {
    title: "Global Supply Chain",
    link: "#",
    thumbnail: "/hero/warehouse.png",
  },
  {
    title: "Predictive Analytics",
    link: "#",
    thumbnail: "/hero/dashboard.png",
  },
  {
    title: "Enterprise AI",
    link: "#",
    thumbnail: "/hero/workflow.jpeg",
  },
];

const HeroParallaxSection: React.FC = () => {
  return <HeroParallax products={products} />;
};

export default HeroParallaxSection;
