const { ethers } = require('ethers');
const { Executor } = require('./executor');
const logger = require('./logger');
const { TransParser } = require('./trans-parser');
const executor = new Executor({ wsNodeUrl: 'ws://51.178.179.113:8546' });
const holdTokens = new Map();
const pendingSwap = new Map();
const confirmedSwap = new Map();
const failedSwap = new Map();
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toLowerCase();
(async () => {
    {
        await parseTest('0xeaa60ebcf9324a005386104fca0591accb4575ca93e0fea0edd2a4129ebc87ef');
        await parseTest('0x1bfb4debc94210c2a0542d10381303ed6d660a76b4cf20d92a800b89802189fc');
        await parseTest('0xd275f2ca8f784c8e0b347c699e117e5cab8a73d2dd37a02d1ef30ee8a0cd5026');
        await parseTest('0xfd407ad69ef3ca8f18ddd5a8c47a1a918d4fb5bcd85391d846f8c2ef1faa3d33');
        await parseTest('0x7c8f104936d01b9e518910bbcc7b1ed959655ee77e2fa0fe9eb164cb7cc3d5c0');
        await parseTest('0x0a5fd9d04a560c4b3955f973e6c4fda41120069c4769452c81a420e651b349f6');
        await parseTest('0x326c34cd732e114fe341287e9cedbdeca1cf2258ffef3b68f5550742cf6dbd28');
        await parseTest('0x086a4781ac244a0c03b23bdb5031e573dbfebae39d698e407ee4c15034f3a28a');
        await parseTest('0xb41d3c686cd8cebbbf1ff0314e711ef2d43f1d58b764f57f768d3dc3fbbb48a9');
        await parseTest('0x0099f442692dec5339ebd52246f5e1f5b3727122c5531262c50e8a01a2ba074b');
        await parseTest('0x9a12000cd097317a72986178f31169541828a86bff833556abdededff606f9a6');
        await parseTest('0xcf0a7e5ce66b877406d2be6b1b811bd123a8c20b627b67fcd51674d561a6dc13');
        await parseTest('0x9560024afd625fcb407ebabc903f32f7f78d5c7dddfc48912e768330d7ac83ec');
        await parseTest('0xe03244c329be5b17d81af260fae5eedb3ba04e76605a2bca6696415e0e092e28');
        await parseTest('0x1c7da7a6fbc57b43454a343ab7f9b55b3e7942f9b96b1eb24d9908f8e23d3538');
        await parseTest('0xbffbe60884279cd3b1179dfbca62128462792d16a9597c92155d2601eac50f78');
        await parseTest('0xde8d830d4bf823ff2988adb98266ba09fdd6b517d91c5c835d59577f3e0a090c');
        await parseTest('0x20db45788e912141da7b89bafebcbb1229337bb31da2135c6fc31d5f3458a6c5');
        await parseTest('0x719f288e47b08a46f0e60da8e6b9c6e06efc682e8415d832efbc6deb53e3c1d0');
        await parseTest('0x90b9d728bc3cba9f05bdd8cac892ecc957a944425214ef437226dc7d9b32b660');
        await parseTest('0x72fae6359ede7d78acb95a313554c336901d7367a59ea461da94e9a41d95ae4f');
        await parseTest('0x7159edf64f292f4a5351c8cd066c9cdb248a1eee26a731974f90fc1bbd7758b2');
        await parseTest('0x7fcc8879a103e7683917de0ca144cc65182ebee98db67581929e0d747307c99c');
        await parseTest('0x31442fd8a78e8f6f7c73fe87f7b125091d3abf4d704c81b51bf3b1885a77cf0e');
        await parseTest('0x6a261823256dc389c07e6426138ee6d537eb0fec0068c4a33f5319ee924719c5');
        await parseTest('0x0d68c90fa1bfd3ac6988a9d406d0391f92112be82188ddad2fe39e8bd89a2a7c');
        await parseTest('0xfb106aec44c95b4ff2abfbc01b8657f7455e0f6c1cc12c9430b872048ed22495');
        await parseTest('0xb3a7bf7c21cbf7b8c3f51fd1f5df4b20468f263ea66b5bbe0c1ed1a2363a9c0b');
        await parseTest('0xc1ef6c13984eb49f70d1c1ec1731af381428e55c958758d80e05a6baac04b1c2');
        await parseTest('0xcc60a95b0147dc6b6fdfeafa0ede913ca081caca107586239384df6444c58b02');
        await parseTest('0x054f983f22a598c447240d40e3baf8773335184cb09e28bfbfeee254dfb02e31');
        await parseTest('0xc0f9b09a17ffdcbe02d716ca6489af1d129c71ae969a7ab05aa34fd6fea13c00');
        await parseTest('0x6949d52c6e5a462c0f686e8d34f3d9d5fb84362b60a76d2417f49cea499ecb4e');
        await parseTest('0xcfea11033700a6e7483ca5106ba84855c1531c6ce398eef39269479389a583d7');
        await parseTest('0x1bb4d7b78e648d4a4ce46da07383bfb6ea5125ee5f50e34526deea1de486d551');
        await parseTest('0x53537187750bf176ab8ba07b21589ed672b0851d784d2f6d43feb74d0cba16b6');
        await parseTest('0xf4c7020490fb7c833d8444ddb81e67aee065963655a3354724c976d3bddd486f');//套娃
        await parseTest('0xcbdc9094e22005026e296cec3d12c9ce3903efee19d92f5464235ad0257ba794');
        await parseTest('0x3c9391f35d638633f98da658012077f4d0f97e3ba2d1d7795830d851ad149564');
        await parseTest('0x3ac54e850cde7b9e465cc0011e7b57c7f6afbe9aabb23d8b410a5dd78e33bbad');
        await parseTest('0x7330c1f2c7251cafe131960fa686d39d042b59469fe3799a499dead00fd70f61');
        await parseTest('0x157304148a9ce3aa8a90019db24000d135e28500d6eb24ad4fbfa83ad10584f0');

    }
    executor.subscribePendingTx(async (rs) => {
        try {
            let tx = rs.tx;
            let gasPrice = ethers.utils.formatUnits(tx.gasPrice, "gwei");
            if (gasPrice < 25) {
                return;
            }
            let parser = new TransParser();
            let params = parser.parseTransaction(tx);
            if (params == null || params.isLiquidity()) {
                return;
            }
            pendingSwap.set(tx.hash, params);
            parseTxTest(tx);
        } catch (error) {
            logger.error(rs.tx.hash);
            logger.error(error);
        }

    });
    executor.subscribeNewBlockTx((rs) => {
        let blockNumber = rs.blockNumber;
        let transactions = rs.transactions;
        transactions.forEach(async hash => {
            if (pendingSwap.has(hash)) {
                let params = pendingSwap.get(hash);
                params.confirmedTime = new Date().getTime();
                confirmedSwap.set(hash, params);
                pendingSwap.delete(hash);
                onSwapConfirmed(hash, params);
            }
        });
        logger.info(`BlockNumber: ${blockNumber} Pending Size: ${pendingSwap.size} Confiremed Size:${confirmedSwap.size}`);
    })
}
)();
async function onSwapConfirmed(hash, params) {
    let receipt = await executor.getTransactionReceipt(hash);
    if (receipt) {
        if (receipt.status === 1) {
            //TODO
        } else {
            failedSwap.set(hash, params);
        }
    }
}




async function parseTest(hash) {
    let tx = await executor.getTransaction(hash);
    if (tx) { await parseTxTest(tx); } else {
        logger.debug(`not found hash : ${hash}`);
    }

}
async function parseTxTest(tx) {
    let parser = new TransParser();
    let params = parser.parseTransaction(tx);
    if (params == null) {
        return;
    }
    logger.debug(`${tx.hash} ${tx.from}`);
    if (params.isLiquidity()) {
        logger.debug("isLiquidity");
        return;
    }
    if (params.paths.length == 0) {
        console.log(tx.hash);
        // exitOnError("未解析");
        logger.error('非正常交易');
    }
    for (let index = 0; index < params.paths.length; index++) {
        const element = params.paths[index];
        let symbol0 = await executor.getSymbol(element.getTokenIn());
        let symbol1 = await executor.getSymbol(element.getTokenOut());
        let decimals0 = await executor.getDecimals(element.getTokenIn());
        let decimals1 = await executor.getDecimals(element.getTokenOut());
        if (symbol0 == "" || symbol1 == "") {
            logger.error(`not found symbol ${element.getTokenIn()} ${element.getTokenOut()}`);
        }
        let amountIn = parseFloat(ethers.utils.formatUnits(element.amountIn, decimals0)).toFixed(4);
        let amountOut = parseFloat(ethers.utils.formatUnits(element.amountOut, decimals1)).toFixed(4);
        logger.debug(`${symbol0}:${amountIn} -> ${symbol1}:${amountOut} `);
        logger.debug(`${element.path}`);

    }
    logger.debug('========================================================================================================================================\n');
}

