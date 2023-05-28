
const { Executor } = require('./executor');
const logger = require('./logger');
const { TransParser } = require('./trans-parser');
const { SwapModel } = require('./storage-db');
const { ethers } = require('ethers');

const executor = new Executor({ wsNodeUrl: 'ws://51.178.179.113:8546' });
const parser = new TransParser();
const etherscanKey = "346J9Q82BCT5G9P3KA97YX3I42TGSVUM8W";
const fetchedMap = new Map();
const axios = require('axios');
const fetchTimeout = 1000 * 60 * 60 * 8;
async function fetchTransactions(address) {
  try {
    const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&sort=desc`;
    const response = await axios.get(url);
    
    if (response.data.status === '1') {
      const transactions = response.data.result;
    //   console.log(transactions);
      return transactions;
    } else {
      console.log('API 请求失败:', response.data.message);
    }
  } catch (error) {
    console.error('请求错误:', error);
  }
}

async function fetchSomeone(ethereumAddress = '0x3726f1Ba0BFef4634C8413823C5cD53B4432db9a'){
    if(fetchedMap.has(ethereumAddress)){
        let timestamp = new Date().getTime();
        let lastTimestamp = fetchedMap.get(ethereumAddress);
        if(timestamp - lastTimestamp < fetchTimeout){
            console.log("刷新频率过快, 冷却时间:",(timestamp - lastTimestamp - fetchTimeout) / 1000);
            return;
        }
    }
    fetchedMap.set(ethereumAddress,new Date().getTime());
    let txlist = await fetchTransactions(ethereumAddress);
    console.log(txlist.length);
    let handlers = []
    for (let index = 0; index < txlist.length; index++) {
        const tx = txlist[index];
        let handler = onTransactionHandler(tx.hash);
        handlers.push(handler);
    }
    await Promise.all(handlers);
    console.log("fetched");
}

async function onTransactionHandler(hash) {
    try {
        let tx = await executor.getTransaction(hash);
        let params = parser.parseTransaction(tx);
        if (params && params.paths && params.paths.length > 0) {
            let receipt = await executor.getTransactionReceipt(hash);
            if (receipt) {
                if (receipt.status === 1) {
                    // console.log(receipt.blockNumber);
                    let blockInfo = await executor.getBlockInfo(receipt.blockNumber);
                    params.confirmedTime = blockInfo.timestamp * 1000;
                    let logs = receipt.logs;
                    let swapMap = new Map();
                    for (let index = 0; index < logs.length; index++) {
                        const logData = logs[index];
                        let parsedLog = await parser.tryParseLog(logData);
                        if (parsedLog) {
                            switch (parsedLog.name) {
                                case "Swap":
                                    let contractAddress = logData.address;
                                    let poolInfo = await executor.getSwapPoolInfo(contractAddress);
                                    if (poolInfo) {
                                        let token0 = poolInfo.token0;
                                        let token1 = poolInfo.token1;
                                        let amount0 = ethers.BigNumber.from('0');
                                        let amount1 = ethers.BigNumber.from('0');
                                        if (!swapMap.has(token0)) {
                                            swapMap.set(token0, amount0);
                                        }
                                        if (!swapMap.has(token1)) {
                                            swapMap.set(token1, amount1);
                                        }
                                        let args = parsedLog.args;
                                        //V2
                                        if (args.amount0In) {
                                            amount0 = amount0.sub(args.amount0In);
                                        }
                                        if (args.amount0Out) {
                                            amount0 = amount0.add(args.amount0Out);
                                        }
                                        if (args.amount1In) {
                                            amount1 = amount1.sub(args.amount1In);
                                        }
                                        if (args.amount1Out) {
                                            amount1 = amount1.add(args.amount1Out);
                                        }
                                        //V3
                                        if (args.amount0) {
                                            amount0 = amount0.sub(args.amount0);
                                        }
                                        if (args.amount1) {
                                            amount1 = amount1.sub(args.amount1);
                                        }
                                        swapMap.set(token0, swapMap.get(token0).add(amount0));
                                        swapMap.set(token1, swapMap.get(token1).add(amount1));
                                    } else {
                                        logger.error(logData.address);
                                    }
                                    break;
                                default:
                                    break;
                            }
                        } else {
                            logger.error("no match interface", logData.address);
                        }
                    }
                    let amounts = [];
                    swapMap.forEach( (value,key) =>{
                        if(value != 0){
                            amounts.push({token:key,amount:value});
                        }
                    });
                    params.amounts = amounts;
                    // logger.info(`${hash} is ok ${params.amounts.length}`);
                    // let swapModel = new SwapModel(params);
                    SwapModel.findOneAndUpdate({ hash }, params, { upsert: true, new: true })
                    .then((result) => {
                        // console.log('添加/更新成功:');
                    })
                    .catch((error) => {
                        console.error('添加/更新错误'+ hash);
                    })
                    // await swapModel.save();
                }
            }
        }
    } catch (error) {
        logger.error(hash);
        logger.error(error);
    }

}

const http = require('http');
const url = require('url');

const server = http.createServer(async (req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  const queryObject = url.parse(req.url,true).query;
  if(queryObject.ethereumAddress){
    console.log("fetch",queryObject.ethereumAddress);
    fetchSomeone(queryObject.ethereumAddress);
  }
  res.end('ok');
});

server.listen(3001, '127.0.0.1', () => {
  console.log('Server running at http://127.0.0.1:3001/?ethereumAddress=0x3726f1Ba0BFef4634C8413823C5cD53B4432db9a');
});