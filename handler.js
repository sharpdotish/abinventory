const AWS = require("aws-sdk");
const express = require("express");
const serverless = require("serverless-http");

const app = express();

const INVENTORY_TABLE = process.env.INVENTORY_TABLE;
const dynamoDbClient = new AWS.DynamoDB.DocumentClient();

app.use(express.json());

/**
 *  POST Stores inventory items in the database
 */
app.post("/inventory", async function (req, res) {
  const restaurantId = req.body.restaurantId;
  const params = {
    TableName: INVENTORY_TABLE,
    Item: {
      restaurantId: req.body.restaurantId,
      inventoryId: req.body.inventoryId,
      name: req.body.name,
      cateory: req.body.category,
      current_stock: req.body.current_stock,
      price: req.body.price,
      supplier: req.body.supplier,
    },
  };

  try {
    await dynamoDbClient.put(params).promise();
    res.json({ restaurantId });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: req });
  }
});

/**
 * GET Display the inventory you just created using the id
 */
app.get("/inventory/item/:restaurantId/:inventoryId", async function (req, res) {
  const params = {
    TableName: INVENTORY_TABLE,
    Key: {
      restaurantId: req.params.restaurantId,
      inventoryId: req.params.inventoryId,
    },
  };

  try {
    const { Item } = await dynamoDbClient.get(params).promise();
    if (Item) {
      const { restaurantId, name, current_stock } = Item;
      res.json({ restaurantId, name, current_stock });
    } else {
      res.status(404).json({ error: "Could not find invetory" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Could not retreive inventory" });
  }
});

/**
 * display the first 10 inventory items in database, allow pagination to show further items
 * pass the last evaluated key from the previous request to load the next page of data.
 * If there is no last evaluated key returned in the result there are no more items to display
 * @param lastEvaluatedKey - the inventory ID as a string, eg food-cakesmoonlc
 */
app.get("/inventory/:restaurantId/:lastEvaluatedKey?", async function (req, res) {

  const getInventorybyRestaurant = async () => {

    let result;
    const pageSize = 10;
    const restaurantId = req.params.restaurantId;

    let params = {
      TableName: INVENTORY_TABLE,
      ExpressionAttributeValues: {
        ":restaurant": restaurantId
      },
      KeyConditionExpression: "restaurantId = :restaurant",
      Limit: pageSize,      
    };

    // if last eval key is set 
    if(typeof req.params.lastEvaluatedKey !== 'undefined'){

      const lastKey = req.params.lastEvaluatedKey;
      
      params.ExclusiveStartKey = {
        "restaurantId": restaurantId ,
        "inventoryId": lastKey,
      }
      // res.status(500).json(params); 
    }

    try {
      result = await dynamoDbClient.query(params).promise();

      if (result) {        
        res.json( result );
      } else {
        res.status(404).json({ error: "Could not find restaurant data" });
      }
    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
  };

  getInventorybyRestaurant().then(console.log).catch(console.error);
});

/**
 * PUT Applies a discount to all the inventory items of a specific category. If no category is provided, apply it to all items.
 */
app.put("/inventory-discount/:category?", async function (req, res) {
  const discountValue = 0.8;

  //@todo theres a typo in the category property in postman, its not worth fixing it at this point!
  const itemCategory = req.params.category;

  var params = {
    TableName: INVENTORY_TABLE,  
  }

  if(typeof itemCategory !== 'undefined'){

    // retrieve the data items in the specified category
    params.ExpressionAttributeValues = {
      ":category": itemCategory,       
    }        
    params.ExpressionAttributeNames = {
      "#category": "cateory",
    }
    params.FilterExpression = "(#category = :category)"

    try {
      // test query to get the items by cat first - see notes below
      result = await dynamoDbClient.scan(params).promise();
      res.status(400).json({ params ,  result } );       
    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
    
  } else {

    // temporary, see below!
    res.status(500).json( {
      error: "No cat set",
    });

  }

    /**
     * THE UPDATE QUERY, 
     * @todo replace above scan with update, 
     * @todo change params to not include filter expression if cat is not set
     * @todo dowhile loop through all results for each scan / update request until lastEvaluatedKey is not set.
     * @todo use a calculation in the update expression string to multiply the current price by discountValue. 
     * (this could later be an additional optional API parammeter but the challenge requirements dont specify that the discount should be dynamic)
    const bulkUpdatePromises = Items.map(async (item) => {
      
      // update each item with the private visibility

      await documentClient
        .update({
          TableName: table,
          Key: { id: item.id },
          UpdateExpression: "SET #visibility = :visibility",
          ExpressionAttributeNames: {
            "#visibility": "visibility",
          },
          ExpressionAttributeValues: {
            ":visibility": "private",
          },
        })
        .promise();
    });
    // wait till bulk update is completed

    await Promise.all(bulkUpdatePromises);
  };

  bulkUpdate();

  res.status(200).json({ status: "Discount applied" });
  */
});

/**
 * Error handling
 */
app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

module.exports.handler = serverless(app);