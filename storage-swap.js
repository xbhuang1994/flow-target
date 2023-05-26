const { ethers } = require('ethers');
const { Executor } = require('./executor');
const logger = require('./logger');
const { TransParser } = require('./trans-parser');
const executor = new Executor({ wsNodeUrl: 'ws://51.178.179.113:8546' });
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toLowerCase();
(async () => {

    executor.subscribeNewBlockTx((rs) => {
        let blockNumber = rs.blockNumber;
        logger.info(`BlockNumber: ${blockNumber}`);
        let transactions = rs.transactions;
        console.log(transactions.length);
        transactions.forEach(async hash => {
            try {
                let tx = await executor.getTransaction(hash);
                let parser = new TransParser();
                // console.log(tx.to);
                let params = parser.parseTransaction(tx);
                if (params && params.paths && params.paths.length > 0) {
                    params.confirmedTime = new Date().getTime();
                    let receipt = await executor.getTransactionReceipt(hash);
                    if (receipt) {
                        if (receipt.status === 1) {
                            logger.info(`${hash} is ok `);
                        }
                    }
                }
            } catch (error) {
                logger.error(hash);
                logger.error(error);
            }

        });

    })
}
)();
