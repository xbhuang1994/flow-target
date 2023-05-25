const { ethers } = require('ethers');
const { Executor } = require('./executor');
const logger = require('./logger');
const { TransParser } = require('./trans_parser');
// const executor = new Executor({ wsNodeUrl: 'wss://fittest-magical-reel.discover.quiknode.pro/e7539618fd1f0e7f4721f9e3f4f153656ccf7a92/' });
const executor = new Executor({ wsNodeUrl: 'ws://51.178.179.113:8546' });
const holdTokens = new Map();
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toLowerCase();
function onPedingHandler(tx, invocation) {
    let token0 = "";
    let token1 = "";
    let amountIn = 0;
    let amountOutMinimum = 0;
    let to = tx.to.toLowerCase();

    if (invocation.name == 'execute' && to == executor.v3Address) {
        let data = invocation.args[1][1];
        token0 = '0x' + data.slice(-104, -64)
        token1 = '0x' + data.slice(-40);
    } else if (invocation.name == "execute" && to == executor.uniAddress) {

        let length = invocation.args[1].length;
        let data = "";
        for (let i = 0; i < length; i++) {
            let element = invocation.args[1][i];
            if (element.length > data.length && (element.startsWith("0x000000000000000000000000000000000000000000000000000000000000000"))) {
                data = element;
            }
        }
        if (data.endsWith("000000000000000000000000000000000000000000000000000000000000")) {
            token0 = '0x' + data.slice(-60 - 40 - 40 - 6, -60 - 40 - 6)
            token1 = '0x' + data.slice(-60 - 40, - 60);
        } else if (data.endsWith('0000')) {
            token0 = '0x' + data.slice(-128, -88)
            token1 = '0x' + data.slice(-82, - 42);
        } else {
            token0 = '0x' + data.slice(-104, -64)
            token1 = '0x' + data.slice(-40);
        }
    } else if (invocation.name == 'swapExactETHForTokens' || invocation.name == 'swapETHForExactTokens' || invocation.name == 'swapExactETHForTokensSupportingFeeOnTransferTokens') {
        let data = invocation.args[1];
        token0 = data[0];
        token1 = data[1];
    } else if (invocation.name == 'swapTokensForExactTokens' || invocation.name == 'swapExactTokensForTokensSupportingFeeOnTransferTokens'
        || invocation.name == 'swapExactTokensForETH' || invocation.name == 'swapExactTokensForTokens' || invocation.name == 'swapTokensForExactETH') {
        token0 = invocation.args[2][0];
        token1 = invocation.args[2][1];

    } else if (invocation.name == 'multicall' && to == executor.v3Address) {
        let array = invocation.args[0];
        for (let index = 0; index < array.length; index++) {
            const element = array[index];
            if (element.startsWith('0xc04b8d59')) { //exactInput((bytes,address,uint256,uint256,uint256))
                let invoc = executor.v3Interface.decodeFunctionData('exactInput((bytes,address,uint256,uint256,uint256))', element);
                token0 = '0x' + invoc[0][0].slice(2, 42)
                token1 = '0x' + invoc[0][0].slice(-40);
                break;

            } else if (element.startsWith('0x04e45aaf') || element.startsWith('0x414bf389')) { //0x04e45aaf is exactInputSingle      
                let invoc = executor.v3Interface.decodeFunctionData("exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))", element);
                token0 = invoc[0][0];
                token1 = invoc[0][1];
                break;
            } else if (element.startsWith('0x49404b7')) { // unwrapWETH9(uint256, address)
                //忽略掉ETH2WETH的调用
            }

        }

    } else if (invocation.name == 'multicall' && to == executor.v3r2Address) {
        let array = invocation.args[invocation.args.length > 1 ? 1 : 0];
        // console.log(array);
        for (let index = 0; index < array.length; index++) {
            const element = array[index];
            // 0x472b43f3 is swapExactTokensForTokens
            if (element.startsWith('0x472b43f3')) {
                let invoc = executor.v3r2Interface.decodeFunctionData("swapExactTokensForTokens(uint256, uint256, address[], address)", element);
                token0 = invoc[2][0];
                token1 = invoc[2][1];
                amountIn = invoc.amountIn;
                amountOutMinimum = invoc.amountOutMin;
                break
            } else if (element.startsWith('0x04e45aaf')) { // 0x04e45aaf is exactInputSingle
                let invoc = executor.v3r2Interface.decodeFunctionData("exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))", element);
                token0 = invoc[0][0];
                token1 = invoc[0][1]
                amountIn = invoc.params.amountIn;
                amountOutMinimum = invoc.params.amountOutMinimum;
                break
            } else if (element.startsWith('0x42712a67')) { // 0x42712a67 is swapTokensForExactTokens
                let invoc = executor.v3r2Interface.decodeFunctionData("swapTokensForExactTokens(uint256, uint256, address[], address)", element);
                token0 = invoc[2][0];
                token1 = invoc[2][1];
                break
            } else if (element.startsWith('0xf3995c67')) {
                // 这是签名，不用理会
            } else if (element.startsWith('0xb858183f')) {
                let invoc = executor.v3r2Interface.decodeFunctionData("exactInput((bytes,address,uint256,uint256))", element);
                token0 = invoc[0][0].slice(0, 42);
                token1 = '0x' + invoc[0][0].slice(-40)
                break
            } else if (element.startsWith('0x5023b4df')) {
                token0 = element.slice(10 + 24, 10 + 24 + 40);
                token1 = element.slice(10 + 24 + 40 + 24, 10 + 24 + 40 + 24 + 40);
            }
        }


    } else if (invocation.name == 'swapExactTokensForETHSupportingFeeOnTransferTokens') {
        let length = invocation.args[2].length;
        token0 = invocation.args[2][0];
        token1 = invocation.args[2][length - 1];
    } else if (invocation.name == 'swapExactTokensForTokens' && to == executor.v3r2Address) {
        token0 = invocation.args[2][0];
        token1 = invocation.args[2][1];
    } else if (invocation.name == 'exactInputSingle' && to == executor.v3Address) {
        token0 = invocation.args[0][0];
        token1 = invocation.args[0][1];

    } else if (invocation.name == 'exactInputSingle' && to == executor.v3r2Address) {
        token0 = invocation.args[0][0];
        token1 = invocation.args[0][1];

    } else if (invocation.name == 'exactInput' && to == executor.v3Address) {
        let data = invocation.args[0][0];
        token0 = '0x' + data.slice(2, 42)
        token1 = '0x' + data.slice(-40);


    } else if (invocation.name == 'exactInput' && to == executor.v3r2Address) {
        let data = invocation.args[0][0];
        token0 = '0x' + data.slice(2, 42)
        token1 = '0x' + data.slice(-40);
    } else if (invocation.name == 'exactOutput' && to == executor.v3Address) {
        let data = invocation.args[0][0];
        token1 = '0x' + data.slice(2, 42)
        token0 = '0x' + data.slice(-40);
    } else {
        if (invocation.name.indexOf('Liquidity') == 0) {
            logger.info(`${tx.hash}, ${invocation.name}, not implemented ==============`);
        }
    }
    return {
        token0: token0, token1: token1, amountIn: amountIn, amountOutMinimum: amountOutMinimum
    }
}
(async () => {
    // let mybalance = await executor.getBalance('0x6469F18574e46a00c85Db160bC97158039A7D2d3');
    // mybalance = ethers.utils.formatEther(mybalance);
    // logger.info(`balance: ${mybalance}`);
    // // let flowlist = ["0xaf2358e98683265cbd3a48509123d390ddf54534", "0x9dda370f43567b9c757a3f946705567bce482c42","0x911d8542A828a0aFaF0e5d94Fee9Ba932C47d72D".toLowerCase()];

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
    // return;
    // let flowlist = ["0x911d8542A828a0aFaF0e5d94Fee9Ba932C47d72D".toLowerCase()];
    executor.subscribePendingTx(async (rs) => {
        let tx = rs.tx;
        let invocation = rs.invocation;
        if (!invocation) {
            return
        }
        let gasPrice = ethers.utils.formatUnits(tx.gasPrice,"gwei");
        if(gasPrice < 30){
            return;
        }
        parseTxTest(tx);

        return
        try {
            let rs = onPedingHandler(tx, invocation);
            if (rs && rs.token0 != '' && rs.token1 != '') {
                if (!flowlist.includes(tx.from.toLowerCase()))
                    return

                let balance = await executor.getBalance(tx.from);
                balance = ethers.utils.formatEther(balance);
                //判断余额大于10 并且是Uniswap V2的交易
                if (balance > 0) {
                    if (rs.token0.toLowerCase() == WETH) {
                        if (!holdTokens.has(rs.token1)) {
                            logger.info("buy >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
                            holdTokens.set(rs.token1, 1);
                        }
                    } else if (rs.token1.toLowerCase() == WETH) {
                        if (holdTokens.has(rs.token0)) {
                            logger.info("sell <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
                            holdTokens.delete(rs.token0);
                        }
                    } else {
                        logger.info("not WETH");
                    }
                    logger.info(`hash: ${tx.hash} function: ${invocation.name}`);
                    logger.info(`from: ${tx.from} token0: ${rs.token0} token1: ${rs.token1} in:${ethers.utils.parseEther(rs.amountIn)} out:${ethers.utils.parseEther(rs.amountOutMinimum)}`);
                    logger.info(`hold token size: ${holdTokens.size}`);
                    if (rs.amountIn == 0) {
                        logger.error(`未解析的函数 ${tx.hash}`);
                    }
                }


                // }
            }
            // if (!rs || (rs && rs.token0 == '')) {
            //     logger.info(`hash: ${tx.hash} function: ${invocation.name}`);
            //     logger.info(`from: ${tx.from} token0: ${rs.token0} token1: ${rs.token1}`);
            // }


        } catch (error) {
            logger.info(tx.hash);
            logger.info(error);
            // (tx.hash, 'undecode!!!', error);
        }

    });
}
)();
async function parseTest(hash) {
    let tx = await executor.getTransaction(hash);
    if (tx) { await parseTxTest(tx); }else{
        logger.info(`not found hash : ${hash}` );
    }

}


async function parseTxTest(tx) {
    let parser = new TransParser();
    let params = parser.parseTransaction(tx);
    if(params.isLiquidity()){
        logger.info("isLiquidity");
        return;
    }
    logger.info(`${tx.hash} ${tx.from}`);
    for (let index = 0; index < params.paths.length; index++) {
        const element = params.paths[index];
        let symbol0 = await executor.getSymbol(element.getTokenIn());
        let symbol1 = await executor.getSymbol(element.getTokenOut());
        let decimals0 = await executor.getDecimals(element.getTokenIn());
        let decimals1 = await executor.getDecimals(element.getTokenOut());
        let amountIn = parseFloat(ethers.utils.formatUnits(element.amountIn, decimals0)).toFixed(4);
        let amountOut = parseFloat(ethers.utils.formatUnits(element.amountOut, decimals1)).toFixed(4);
        logger.info(`${symbol0}:${amountIn} -> ${symbol1}:${amountOut} `);
        logger.info(`${element.path}`);
    }
    logger.info('========================================================================================================================================\n');
}

