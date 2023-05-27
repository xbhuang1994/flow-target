const { Executor } = require('./executor');
const logger = require('./logger');
const { TransParser } = require('./trans-parser');
const { SwapModel } = require('./storage-db');
const { ethers } = require('ethers');
const executor = new Executor({ wsNodeUrl: 'ws://51.178.179.113:8546' });
const parser = new TransParser();
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toLowerCase();
(async () => {

    // await onTransactionHandler("0x2b29ff60a82b794395dd28599dde25c6c01939d491e10c17bf10139bc1443646")
    executor.subscribeNewBlockTx((rs) => {
        let blockNumber = rs.blockNumber;
        logger.info(`BlockNumber: ${blockNumber}`);
        let transactions = rs.transactions;
        console.log(blockNumber,transactions.length);
        transactions.forEach(onTransactionHandler);

    })
    
}
)();

async function onTransactionHandler(hash) {
    try {
        let tx = await executor.getTransaction(hash);
        let params = parser.parseTransaction(tx);
        if (params && params.paths && params.paths.length > 0) {
            let receipt = await executor.getTransactionReceipt(hash);
            if (receipt) {
                if (receipt.status === 1) {
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
                    SwapModel.findOneAndUpdate({ hash }, params, { upsert: true, new: true })
                    .then((result) => {
                        
                    })
                    .catch((error) => {
                        logger.error(`${hash} save db error:`);
                        logger.error(error);
                    })
                }
            }
        }
    } catch (error) {
        logger.error(hash);
        logger.error(error);
    }

}

