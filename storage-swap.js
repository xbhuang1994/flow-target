const { Executor } = require('./executor');
const logger = require('./logger');
const { TransParser } = require('./trans-parser');
const { SwapModel } = require('./storage-db');
const { ethers } = require('ethers');
const executor = new Executor({ wsNodeUrl: 'ws://51.178.179.113:8546' });
const parser = new TransParser();
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toLowerCase();
(async () => {

    // executor.subscribeNewBlockTx((rs) => {
    //     let blockNumber = rs.blockNumber;
    //     logger.info(`BlockNumber: ${blockNumber}`);
    //     let transactions = rs.transactions;
    //     console.log(transactions.length);
    //     transactions.forEach(onTransactionHandler);

    // })
    onTransactionHandler("0xf1d7fe604151f12534ad65a0b6282ee162202c1ef699aa1a261110d110fdfb7d")
}
)();

async function onTransactionHandler(hash) {
    try {
        let tx = await executor.getTransaction(hash);
        // console.log(tx.to);
        let params = parser.parseTransaction(tx);
        if (params && params.paths && params.paths.length > 0) {
            params.confirmedTime = new Date().getTime();
            let receipt = await executor.getTransactionReceipt(hash);
            if (receipt) {
                if (receipt.status === 1) {
                    let logs = receipt.logs;
                    let swapMap = new Map();
                    logs.forEach(async logData => {
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
                                        // if (args.amount0) {
                                        //     amount0 += args.amount0
                                        // }
                                        // if (args.amount1) {
                                        //     amount1 -= args.amount1;
                                        // }
                                        swapMap.set(token0, swapMap.get(token0).add(amount0));
                                        swapMap.set(token1, swapMap.get(token1).add(amount1));
                                        logger.info(`${tx.hash} ${token0} ${token1} ${swapMap.get(token0)} ${swapMap.get(token1)}`);
                                    } else {
                                        logger.error(logData.address);
                                        // console.log(parsedLog);
                                    }
                                    break;
                                default:
                                    break;
                            }
                        } else {
                            logger.error("no match interface", logData.address);
                        }
                    });

                    // console.log(logs[0]);
                    // 解析日志数据
                    // const parsedLog = contractInterface.parseLog(logs);
                    // console.log('Logs:', parsedLog);
                    return
                    logger.info(`${hash} is ok `);
                    let swapModel = new SwapModel(params);
                    await swapModel.save();
                }
            }
        }
    } catch (error) {
        logger.error(hash);
        logger.error(error);
    }

}

