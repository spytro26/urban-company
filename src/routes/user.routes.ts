import { Router } from "express";
import { prisma } from "../../db/index.ts";

import { use } from "react";
const router = Router();

// Placeholder route for user-related operations
router.get("/", (req, res) => {
  res.json({ message: "User routes placeholder" });
});


// order , notification , profile update routes will be added here in future
router.get("/orders",  async (req, res) => {
 
  const userId = req.user!.id;
  const {mode , serviceCharge , gst , servicetime , agentId} = req.body;
  if(!mode || !serviceCharge || !servicetime || !agentId || !userId){
    res.status(400).json({message : "Missing required fields"});
    return;
  }

  // validate gst is correct 

  const agent = await prisma.agent.findUnique({where : {id : agentId}});
    if(!agent){
        res.status(404).json({message : "Agent not found"});
        return;
    }
    if(agent.isAvailable === false){
        res.status(400).json({message : "Agent is not available"});
        return;
    }

     // take online payment and confirm order
     



    const order = await prisma.orders.create({
        data : {
            userId,
            agentId,
            mode,
            serviceCharge,
            gst,
            servicetime
        }
    });

    res.status(201).json({message : "Order created successfully" , order});


});

router.get("/notifications", (req, res) => {
  res.json({ message: "User notifications placeholder" });
});

router.put("/profile", (req, res) => {
  res.json({ message: "User profile update placeholder" });
  
});


export default router;