const { Executor } = require('./executor');
const logger = require('./logger');
const executor = new Executor({ wsNodeUrl: 'wss://fittest-magical-reel.discover.quiknode.pro/e7539618fd1f0e7f4721f9e3f4f153656ccf7a92/' });

function onPedingHandler(tx, invocation) {
    let token0 = "";
    let token1 = "";
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
        if (!data.endsWith("0000")) {
            token0 = '0x' + data.slice(-104, -64)
            token1 = '0x' + data.slice(-40);
        } else if (data.endsWith("000000000000000000000000000000000000000000000000000000000000")) {
            token0 = '0x' + data.slice(-60 - 40 - 40 - 6, -60 - 40 - 6)
            token1 = '0x' + data.slice(-60 - 40, - 60);
        }
        else {
            token0 = '0x' + data.slice(-128, -88)
            token1 = '0x' + data.slice(-82, - 42);
        }
    } else if (invocation.name == 'swapExactETHForTokens' || invocation.name == 'swapETHForExactTokens' || invocation.name == 'swapExactETHForTokensSupportingFeeOnTransferTokens') {
        let data = invocation.args[1];
        token0 = data[0];
        token1 = data[1];
    } else if (invocation.name == 'swapTokensForExactTokens' || invocation.name == 'swapExactTokensForTokensSupportingFeeOnTransferTokens' || invocation.name == 'swapExactTokensForETH'){
        token0 = invocation.args[2][0];
        token1 = invocation.args[2][1];

    } else if (invocation.name == 'multicall' && to == executor.v3Address) {
        let data = invocation.args[0][0];
        let invoc = executor.v3Interface.decodeFunctionData("exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))", data);
        token0 = invoc[0][0];
        token1 = invoc[0][1];
    } else if (invocation.name == 'multicall' && to == executor.v3r2Address) {
        let length = invocation.args.length;
        if (length == 1 && invocation.args[0][0].startsWith("0x04e45aaf")) {
            token0 = '0x' + invocation.args[0][0].slice(34, 34 + 40);
            token1 = '0x' + invocation.args[0][0].slice(34 + 64, 34 + 64 + 40);
        } else {
            let data = invocation.args[invocation.args.length>1?1:0][0];
            // 0x472b43f3 is swapExactTokensForTokens
            if (data.startsWith('0x472b43f3')) {
                let invoc = executor.v3r2Interface.decodeFunctionData("swapExactTokensForTokens(uint256, uint256, address[], address)", data);
                token0 = invoc[2][0];
                token1 = invoc[2][1];
            // 0x04e45aaf is exactInputSingle
            } else if(data.startsWith('0x04e45aaf')){
                let invoc = executor.v3r2Interface.decodeFunctionData("exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))",data);
                token0 = invoc[0][0];
                token1 = invoc[0][1]
            }else {
                let invoc = executor.v3r2Interface.decodeFunctionData("exactInput((bytes,address,uint256,uint256))", data);
                token0 = invoc[0][0].slice(0, 42);
                token1 = '0x' + invoc[0][0].slice(-40)
            }
        }


    } else if (invocation.name == 'swapExactTokensForETHSupportingFeeOnTransferTokens') {
        let length = invocation.args[2].length;
        token0 = invocation.args[2][0];
        token1 = invocation.args[2][length - 1];
    } else if (invocation.name == 'swapExactTokensForTokens' && to == executor.v3r2Address) {
        token0 = invocation.args[2][0];
        token1 = invocation.args[2][1];
    } else if (invocation.name == 'exactInputSingle' && to == executor.v3Address){
        token0 = invocation.args[0][0];
        token1 = invocation.args[0][1];

    }else {
        logger.info(`${tx.hash}, ${invocation.name}, not implemented ==============`);
        return
    }
    return {
        token0: token0, token1: token1
    }
}
(async () => {

    let tx = await executor.getTransaction('0xf30ecbcd0befac9293ed62fd08e6a97a387fa9df5dad950cbbc91a8bf305a5d7');
    let invocation = executor.parseTransaction(tx);
    let rs = onPedingHandler(tx, invocation);
    if (rs) {
        logger.info(`hash: ${tx.hash} function: ${invocation.name}`);
        logger.info(`from: ${tx.from} token0: ${rs.token0} token1: ${rs.token1}`);
    }

    // return;
    executor.subscribePendingTx((rs) => {
        let tx = rs.tx;
        let invocation = rs.invocation;
        if (!invocation) {
            return
        }
        try {
            let rs = onPedingHandler(tx, invocation);
            if (rs) {
                logger.info(`hash: ${tx.hash} function: ${invocation.name}`);
                logger.info(`from: ${tx.from} token0: ${rs.token0} token1: ${rs.token1}`);
            }

        } catch (error) {
            logger.info(tx.hash);
            logger.info(error);
            // (tx.hash, 'undecode!!!', error);
        }

    });
}
)();
