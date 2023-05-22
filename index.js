const { ethers } = require('ethers');
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
    } else if (invocation.name == 'swapTokensForExactTokens' || invocation.name == 'swapExactTokensForTokensSupportingFeeOnTransferTokens' || invocation.name == 'swapExactTokensForETH' || invocation.name == 'swapExactTokensForTokens') {
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

            } else if (element.startsWith('0x04e45aaf')) { //0x04e45aaf is exactInputSingle      
                let invoc = executor.v3Interface.decodeFunctionData("exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))", element);
                token0 = invoc[0][0];
                token1 = invoc[0][1];
                break;
            } else if (element.startsWith('0x49404b7')) { // unwrapWETH9(uint256, address)
                //nothing!
            }

        }

    } else if (invocation.name == 'multicall' && to == executor.v3r2Address) {
        // let length = invocation.args.length;
        // if (length == 1 && invocation.args[0][0].startsWith("0x04e45aaf")) {
        //     token0 = '0x' + invocation.args[0][0].slice(34, 34 + 40);
        //     token1 = '0x' + invocation.args[0][0].slice(34 + 64, 34 + 64 + 40);
        // } else {
        let array = invocation.args[invocation.args.length > 1 ? 1 : 0];
        // let array = invocation.args;
        for (let index = 0; index < array.length; index++) {
            const element = array[index];
            // console.log(element);
            // 0x472b43f3 is swapExactTokensForTokens
            if (element.startsWith('0x472b43f3')) {
                let invoc = executor.v3r2Interface.decodeFunctionData("swapExactTokensForTokens(uint256, uint256, address[], address)", element);
                token0 = invoc[2][0];
                token1 = invoc[2][1];
                break
            } else if (element.startsWith('0x04e45aaf')) { // 0x04e45aaf is exactInputSingle
                let invoc = executor.v3r2Interface.decodeFunctionData("exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))", element);
                token0 = invoc[0][0];
                token1 = invoc[0][1]
                break
            } else if (element.startsWith('0x42712a67')) { // 0x42712a67 is swapTokensForExactTokens
                let invoc = executor.v3r2Interface.decodeFunctionData("swapTokensForExactTokens(uint256, uint256, address[], address)", element);
                token0 = invoc[2][0];
                token1 = invoc[2][1];
                break
            } else if (element.startsWith('0xf3995c67')) {
                // 这是签名，不用理会
            } else if (element.startsWith('0xc04b8d59')) {
                let invoc = executor.v3r2Interface.decodeFunctionData("exactInput((bytes,address,uint256,uint256))", data);
                token0 = invoc[0][0].slice(0, 42);
                token1 = '0x' + invoc[0][0].slice(-40)
                break
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
    } else if(invocation.name == 'exactOutput' && to == executor.v3Address){
        let data = invocation.args[0][0];
        token1 = '0x' + data.slice(2, 42)
        token0 = '0x' + data.slice(-40);
    }else {
        if(invocation.name.indexOf('Liquidity')== 0){
            logger.info(`${tx.hash}, ${invocation.name}, not implemented ==============`);
        }
        return
    }
    return {
        token0: token0, token1: token1
    }
}
(async () => {
    let mybalance = await executor.getBalance('0x6469F18574e46a00c85Db160bC97158039A7D2d3');
    mybalance = ethers.formatEther(mybalance);
    logger.info(`balance: ${mybalance}`);
    // return;
    let tx = await executor.getTransaction('0x87fa639e9e9b02cb2c42c1f36941cddf8262a6111e80cba57aea78e2191b9c26');
    let invocation = executor.parseTransaction(tx);
    let rs = onPedingHandler(tx, invocation);
    // if (rs) {
    logger.info(`hash: ${tx.hash} function: ${invocation.name}`);
    logger.info(`from: ${tx.from} token0: ${rs.token0} token1: ${rs.token1}`);
    // }

    // return;
    executor.subscribePendingTx(async (rs) => {
        let tx = rs.tx;
        let invocation = rs.invocation;
        if (!invocation) {
            return
        }
        try {
            let rs = onPedingHandler(tx, invocation);
            // if (rs) {
            //     let balance = await executor.getBalance(tx.from);
            //     balance = ethers.formatEther(balance);
            //     if (balance > 10) {
            //     logger.info(`hash: ${tx.hash} function: ${invocation.name}`);
            //     logger.info(`from: ${tx.from} balance: ${balance} token0: ${rs.token0} token1: ${rs.token1}`);
            //     }

            // }
            if (!rs) {
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
