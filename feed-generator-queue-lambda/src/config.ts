import AWS from "aws-sdk";
const region = "ap-south-1";

AWS.config.update({
  region: region,
});

const dynamoClient = new AWS.DynamoDB.DocumentClient();

// TODO: enter details below
const rdsUsername = "[Your RDS User name]";
const hostName = "[insert your RDS Proxy endpoint here]";
const dbName = "[insert your RDS instance name]";

// TODO: enter details below
const followingTableName = "[insert table name]";

const signer = new AWS.RDS.Signer({
  region: region,
  hostname: hostName,
  port: 3306,
  username: rdsUsername,
});

const GeneralPopTable = "GeneralPopTable";

interface FeedItem {
  postId: string;
  imageUrl: string;
  timestamp: number;
}

interface GeneralPopTableKeySchema {
  PK: string;
  SK: string;
}

function generateKeyForFeedFromTable(username: string) {
  return <GeneralPopTableKeySchema>{
    PK: `USER#${username}`,
    SK: `FEED#${username}`,
  };
}

export {
  hostName,
  rdsUsername,
  dbName,
  signer,
  followingTableName,
  dynamoClient,
  GeneralPopTable,
  FeedItem,
  generateKeyForFeedFromTable,
};
