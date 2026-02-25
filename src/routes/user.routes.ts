import { Router } from "express";
import { prisma } from "../../db/index.ts";
import { userMiddleware } from "../middleware/user.middleware.ts";
const router = Router();
//
// user can approve or reject a request from the plubmer / electrician
// user can order
// user can view all the request
// user can view all the orders
router.use(userMiddleware);
// Placeholder route for user-related operations

// Get user orders with pagination is this url correct ?
router.get("/orders", async (req, res) => {
  try {
    const userId = req.user!.id;

    if (!userId) {
      return res.status(400).json({ error: "user id not present" });
    }

    const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;

    const orders = await prisma.orderGroup.findMany({
      where: {
        userId,
      },

      include: {
        agent: {
          select: {
            name: true,
            type: true,
          },
        },
      },

      orderBy: [
        { createdAt: "desc" }, //
        { id: "desc" },
      ],

      take: 10,

      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    // send next cursor
    const nextCursor =
      orders.length === 10 ? orders[orders.length - 1]?.id : null;

    res.json({
      orders,
      nextCursor,
    });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/orderdetails/:orderId", async (req, res) => {
  try {
    const userId = req.user!.id;
    const orderId = parseInt(req.params.orderId);

    if (!userId) {
      return res.status(400).json({ message: "user not present" });
    }

    if (isNaN(orderId)) {
      return res.status(400).json({ message: "invalid order id" });
    }

    const orderDetails = await prisma.orderGroup.findFirst({
      where: {
        id: orderId,
        userId, // ensure the order belongs to this user
      },
      include: {
        orders: {
          include: {
            subservice: {
              select: {
                id: true,
                name: true,
                price: true,
                description: true,
              },
            },
          },
        },
        extraMaterials: {
          select: {
            id: true,
            name: true,
            quantity: true,
            price: true,
            description: true,
            createdAt: true,
            addedByAgent: {
              select: {
                name: true,
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            transactionId: true,
            note: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        agent: {
          select: {
            id: true,
            name: true,
            type: true,
            rating: true,
            profilepic: true,
          },
        },
      },
    });

    if (!orderDetails) {
      return res.status(404).json({ message: "order not found" });
    }

    // compute payment summary
    const totalPaid = orderDetails.payments.reduce(
      (sum, p) => sum + p.amount,
      0,
    );
    const extraMaterialTotal = orderDetails.extraMaterials.reduce(
      (sum, m) => sum + m.price * m.quantity,
      0,
    );

    res.json({
      order: orderDetails,
      summary: {
        extraMaterialTotal,
        totalPaid,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Create a new order
router.post("/orders", async (req, res) => {
  try {
    const userId = req.user!.id;

    if (!userId) {
      return res.status(400).json({ error: "user id not present" });
    }

    const { name, description, servicetime, services } = req.body as {
      name?: string;
      description?: string;
      servicetime: string;
      services: { subserviceId: number; serviceCharge: number }[];
    };

    // validate required fields
    if (!servicetime) {
      return res.status(400).json({ error: "servicetime is required" });
    }

    if (!services || !Array.isArray(services) || services.length === 0) {
      return res
        .status(400)
        .json({ error: "at least one service is required" });
    }

    // validate all subserviceIds exist
    const subserviceIds = services.map((s) => s.subserviceId);
    const existingServices = await prisma.subservice.findMany({
      where: { id: { in: subserviceIds } },
      select: { id: true },
    });

    if (existingServices.length !== subserviceIds.length) {
      const found = new Set(existingServices.map((s) => s.id));
      const missing = subserviceIds.filter((id) => !found.has(id));
      return res
        .status(400)
        .json({ error: `subservice ids not found: ${missing.join(", ")}` });
    }

    // compute total price
    const totalPrice = services.reduce((sum, s) => sum + s.serviceCharge, 0);

    // explicit transaction: create OrderGroup + Orders atomically
    const order = await prisma.$transaction(async (tx) => {
      const orderGroup = await tx.orderGroup.create({
        data: {
          userId,
          name,
          description,
          servicetime: new Date(servicetime),
          totalPrice,
        },
      });

      await tx.orders.createMany({
        data: services.map((s) => ({
          subserviceId: s.subserviceId,
          serviceCharge: s.serviceCharge,
          groupId: orderGroup.id,
        })),
      });

      // return full order with relations
      return tx.orderGroup.findUnique({
        where: { id: orderGroup.id },
        include: {
          orders: {
            include: {
              subservice: {
                select: {
                  name: true,
                  price: true,
                },
              },
            },
          },
        },
      });
    });

    res.status(201).json({ order });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Cancel an order (only if still PENDING)
router.patch("/orders/:orderId/cancel", async (req, res) => {
  try {
    const userId = req.user!.id;
    const orderId = parseInt(req.params.orderId);

    if (isNaN(orderId)) {
      return res.status(400).json({ error: "invalid order id" });
    }

    const order = await prisma.orderGroup.findFirst({
      where: { id: orderId, userId },
      select: { id: true, status: true, paymentStatus: true },
    });

    if (!order) {
      return res.status(404).json({ error: "order not found" });
    }

    if (order.status !== "PENDING") {
      return res
        .status(400)
        .json({ error: "only pending orders can be cancelled" });
    }

    const updated = await prisma.orderGroup.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });

    res.json({ order: updated });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});



// Get user profile
router.get("/profile", async (req, res) => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        address: true,
        pin: true,
        profilepic: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Update user profile
router.put("/profile", async (req, res) => {
  try {
    const userId = req.user!.id;

    const { address, pin } = req.body as {
      address?: string;
      pin?: string;
    };

    if (!address && !pin) {
      return res
        .status(400)
        .json({ error: "provide at least one field to update" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(address && { address }),
        ...(pin && { pin }),
      },
      select: {
        id: true,
        email: true,
        address: true,
        pin: true,
        profilepic: true,
        createdAt: true,
      },
    });

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Get user notifications with pagination
router.get("/notifications", async (req, res) => {
  try {
    const userId = req.user!.id;
    const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const nextCursor =
      notifications.length === 20
        ? notifications[notifications.length - 1]?.id
        : null;

    res.json({ notifications, nextCursor });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Mark a notification as read
router.patch("/notifications/:notifId/read", async (req, res) => {
  try {
    const userId = req.user!.id;
    const notifId = parseInt(req.params.notifId);

    if (isNaN(notifId)) {
      return res.status(400).json({ error: "invalid notification id" });
    }

    const notif = await prisma.notification.findFirst({
      where: { id: notifId, userId },
    });

    if (!notif) {
      return res.status(404).json({ error: "notification not found" });
    }

    const updated = await prisma.notification.update({
      where: { id: notifId },
      data: { isRead: true },
    });

    res.json({ notification: updated });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Mark all notifications as read
router.patch("/notifications/read-all", async (req, res) => {
  try {
    const userId = req.user!.id;

    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ markedRead: result.count });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
