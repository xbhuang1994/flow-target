const { ethers } = require('ethers');
const logger = require('./logger.js');
const axios = require('axios');
const fs = require('fs');
const RouterType = {
    None: 0,
    UniswapV2R2: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    UniswapV3: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    UniswapV3R2: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    UniswapUniversal: "0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B"
}
const UniversalCommands = {
    // Masks to extract certain bits of commands
    FLAG_ALLOW_REVERT: 0x80,
    COMMAND_TYPE_MASK: 0x1f,
    NFT_TYPE_MASK: 0x10,
    SUB_IF_BRANCH_MASK: 0x08,

    // Command Types. Maximum supported command at this moment is 0x1F.

    // Command Types where value<0x08, executed in the first nested-if block
    V3_SWAP_EXACT_IN: 0x00,
    V3_SWAP_EXACT_OUT: 0x01,
    PERMIT2_TRANSFER_FROM: 0x02,
    PERMIT2_PERMIT_BATCH: 0x03,
    SWEEP: 0x04,
    TRANSFER: 0x05,
    PAY_PORTION: 0x06,
    COMMAND_PLACEHOLDER_0x07: 0x07,

    // Command Types where 0x08<=value<=0x0f, executed in the second nested-if block
    V2_SWAP_EXACT_IN: 0x08,
    V2_SWAP_EXACT_OUT: 0x09,
    PERMIT2_PERMIT: 0x0a,
    WRAP_ETH: 0x0b,
    UNWRAP_WETH: 0x0c,
    PERMIT2_TRANSFER_FROM_BATCH: 0x0d,
    COMMAND_PLACEHOLDER_0x0e: 0x0e,
    COMMAND_PLACEHOLDER_0x0f: 0x0f,

    // Command Types where 0x10<=value<0x18, executed in the third nested-if block
    SEAPORT: 0x10,
    LOOKS_RARE_721: 0x11,
    NFTX: 0x12,
    CRYPTOPUNKS: 0x13,
    LOOKS_RARE_1155: 0x14,
    OWNER_CHECK_721: 0x15,
    OWNER_CHECK_1155: 0x16,
    SWEEP_ERC721: 0x17,

    // Command Types where 0x18<=value<=0x1f, executed in the final nested-if block
    X2Y2_721: 0x18,
    SUDOSWAP: 0x19,
    NFT20: 0x1a,
    X2Y2_1155: 0x1b,
    FOUNDATION: 0x1c,
    SWEEP_ERC1155: 0x1d,
    COMMAND_PLACEHOLDER_0x1e: 0x1e,
    COMMAND_PLACEHOLDER_0x1f: 0x1f,
}
const ADDR_SIZE = 40;
const FEE_SIZE = 6;
const NEXT_OFFSET = ADDR_SIZE + FEE_SIZE;
const POP_OFFSET = NEXT_OFFSET + ADDR_SIZE;
const MULTIPLE_POOLS_MIN_LENGTH = POP_OFFSET + NEXT_OFFSET;
class Path {
    constructor(amountIn, amountOut, pathStr = null) {
        if (pathStr) {
            this.pathStr = pathStr;
            this.path = this.getPaths();
        }
        this.amountIn = amountIn;
        this.amountOut = amountOut;

    }
    /// @notice Returns true iff the path contains two or more pools
    /// @param path The encoded swap path
    /// @return True if path contains two or more pools, otherwise false
    hasMultiplePools() {
        return this.pathStr.length >= MULTIPLE_POOLS_MIN_LENGTH - 2;
    }
    getPaths() {
        let paths = [];
        let start = 2;
        while (start < this.pathStr.length) {
            let token = this.pathStr.substr(start, ADDR_SIZE);
            paths.push("0x" + token);
            start = start + NEXT_OFFSET;
        }
        return paths;
    }
    getTokenIn() {
        return this.path[0];
    }
    getTokenOut() {
        return this.path[this.path.length - 1];
    }
    reverse() {
        this.path = this.path.reverse();
        let amountOut = this.amountIn;
        this.amountIn = this.amountOut;
        this.amountOut = amountOut;
    }

}
class Params {
    constructor(tx, invocation, paths) {
        this.hash = tx.hash;
        this.routerType = tx.to;
        this.paths = paths;
        this.gasPrice = tx.gasPrice;
        this.from = tx.from;
        this.gasLimit = tx.gasLimit;
        this.firstTime = new Date().getTime();
        this.confirmedTime = 0;
        this.tx = tx;
        this.invocation = invocation;
    }
    isLiquidity() {
        return this.invocation.name.includes('Liquidity');
    }

}
class TransParser {
    constructor() {
        this.abiMap = {};
        this.interfaces = [];
        this.erc20Interface = new ethers.utils.Interface(this.abi('erc20'));
        this.v2Interface = new ethers.utils.Interface(this.abi('v2_router'));
        this.v3Interface = new ethers.utils.Interface(this.abi('v3_router'));
        this.v3r2Interface = new ethers.utils.Interface(this.abi('v3_router2'));
        this.uniInterface = new ethers.utils.Interface(this.abi('uni_router'));
        this.v2PoolInterface = new ethers.utils.Interface(this.abi('v2_pool'));
        this.v3PoolInterface = new ethers.utils.Interface(this.abi('v3_pool'));
        this.wethInterface = new ethers.utils.Interface(this.abi('weth'));
        this.permit2Interface = new ethers.utils.Interface(this.abi('permit2'));
        this.interfaces.push(this.permit2Interface);
        this.interfaces.push(this.wethInterface);
        this.interfaces.push(this.v2Interface);
        this.interfaces.push(this.v3Interface);
        this.interfaces.push(this.v3r2Interface);
        this.interfaces.push(this.uniInterface);
        this.interfaces.push(this.v2PoolInterface);
        this.interfaces.push(this.v3PoolInterface);
        this.fetchingAbiMap = new Map();
        this.loadNonStandardInterfaces();
    }
    loadNonStandardInterfaces() {
        const path = require('path');
        const directoryPath = "./abi/non-standard";
        // 读取指定文件夹下的所有文件
        fs.readdir(directoryPath, (err, files) => {
            if (err) {
                console.error('Error reading directory:', err);
                return;
            }
            files.forEach(file => {
                if(file.endsWith('json')){
                    // 构建文件路径
                    const filePath = path.join(directoryPath, file);
                    let json = require('./'+filePath);
                    let inter = new ethers.utils.Interface(json);
                    this.interfaces.push(inter);
                }
            });
        });
    }
    async getContractABI(contractAddress) {
        try {
            let response = null;
            if (this.fetchingAbiMap.has(contractAddress)) {
                response = await this.fetchingAbiMap.get(contractAddress);
            } else {
                // 发送请求获取合约信息
                const responsePromise = axios.get(`https://api.etherscan.io/api?module=contract&action=getabi&address=${contractAddress}&apikey=346J9Q82BCT5G9P3KA97YX3I42TGSVUM8W`);
                this.fetchingAbiMap.set(contractAddress, responsePromise);
                response = await responsePromise;
            }
            if (this.fetchingAbiMap.has(contractAddress))
                this.fetchingAbiMap.delete(contractAddress);

            if (response && response.data.status === '1') {
                const abi = JSON.parse(response.data.result);
                let outputPath = `./abi/non-standard/${contractAddress}_abi.json`;
                // 将 ABI 写入文件
                fs.writeFileSync(outputPath, JSON.stringify(abi, null, 2));
                return abi;
            } else {
                console.log('Error retrieving contract ABI:', response.data.message, contractAddress);
                return null;
            }
        } catch (error) {
            logger.error('Error:', error.message);
        }
    }
    async tryParseLog(logData) {
        let array = this.interfaces;
        for (let index = 0; index < array.length; index++) {
            const element = array[index];
            try {
                let log = element.parseLog(logData);
                return log;
            } catch (error) {

            }
        }
        try {   
            let abi = await this.getContractABI(logData.address);
            let inter = new ethers.utils.Interface(abi);
            this.interfaces.push(inter);
            return inter.parseLog(logData);
        } catch (error) {
            return null;    
        }
    }
    abi(name) {
        let abi = this.abiMap[name];
        if (!abi) {
            abi = require(`./abi/${name}_abi.json`);
        }
        this.abiMap[name] = abi;
        return abi;
    }
    parseTransaction(tx) {
        // console.log(tx);
        let params = null;
        switch (tx.to) {
            case RouterType.UniswapV2R2:
                params = this.parseUniV2Swap(tx);
                break;
            case RouterType.UniswapV3:
                params = this.parseUniV3(tx);
                break;
            case RouterType.UniswapV3R2:
                params = this.parseUniV3R2(tx);
                break;
            case RouterType.UniswapUniversal:
                params = this.parseUniswapUniversal(tx);
                break;
            default:
                // logger.info("不支持的协议");
                break;
        }
        return params;
    }
    parseUniV2Swap(tx) {
        let invocation = this.v2Interface.parseTransaction(tx);
        let paths = []
        if (invocation.name.includes('Liquidity')) {
            return new Params(tx, invocation, null);
        }
        switch (invocation.name) {
            case "swapTokensForExactTokens":
            case "swapTokensForExactETH":
                {

                    let args = invocation.args;
                    let amountIn = args.amountInMax;
                    let amountOut = args.amountOut;
                    let path = new Path(amountIn, amountOut);
                    path.path = args.path;
                    paths.push(path);
                }
                break;
            case "swapExactTokensForETH":
            case "swapExactTokensForTokens":
            case "swapExactTokensForTokensSupportingFeeOnTransferTokens":
            case "swapExactTokensForETHSupportingFeeOnTransferTokens":
                {

                    let args = invocation.args;
                    let amountIn = args.amountIn;
                    let amountOutMin = args.amountOutMin;
                    let path = new Path(amountIn, amountOutMin);
                    path.path = args.path;
                    paths.push(path);
                }
                break;
            case "swapETHForExactTokens":
                {
                    let args = invocation.args;
                    let amountIn = tx.value;
                    let amountOut = args.amountOut;
                    let path = new Path(amountIn, amountOut);
                    path.path = args.path;
                    paths.push(path);
                }
                break;
            case "swapExactETHForTokensSupportingFeeOnTransferTokens":
            case "swapExactETHForTokens":
                {
                    let args = invocation.args;
                    let amountIn = tx.value;
                    let amountOutMin = args.amountOutMin;
                    let path = new Path(amountIn, amountOutMin);
                    path.path = args.path;
                    paths.push(path);
                }
                break;
            default:
                logger.debug(tx.hash);
                exitOnError("未解析");
                break;
        }
        return new Params(tx, invocation, paths);
    }
    parseUniV3(tx) {
        let invocation = this.v3Interface.parseTransaction(tx);
        let paths = [];
        switch (invocation.name) {
            case "exactInput":
                {
                    let args = invocation.args.params;
                    let path = new Path(args.amountIn, args.amountOutMinimum, args.path);
                    paths.push(path);
                }
                break;
            case "multicall":
                invocation.args.data.forEach(element => {
                    let sig = this.v3Interface.getFunction(element.substring(0, 10));
                    if (element.startsWith("0x414bf389")) {
                        let invoc = this.v3Interface.decodeFunctionData('exactInputSingle', element);
                        let args = invoc.params;
                        let path = new Path(args.amountIn, args.amountOutMinimum);
                        path.path = [args.tokenIn, args.tokenOut];
                        paths.push(path);
                    } else if (element.startsWith("0xdb3e2198")) {
                        let invoc = this.v3Interface.decodeFunctionData('exactOutputSingle', element);
                        let args = invoc.params;
                        let path = new Path(args.amountInMaximum, args.amountOut);
                        path.path = [args.tokenIn, args.tokenOut];
                        paths.push(path);
                    } else if (sig.name == "exactInput") {
                        let invoc = this.v3Interface.decodeFunctionData(sig, element);
                        let args = invoc.params;
                        let path = new Path(args.amountIn, args.amountOutMinimum, args.path);
                        paths.push(path);
                    } else if (sig.name == "exactOutput") {
                        let invoc = this.v3Interface.decodeFunctionData(sig, element);
                        let args = invoc.params;
                        let path = new Path(args.amountOut, args.amountInMaximum, args.path);
                        path.reverse();
                        paths.push(path);
                    }
                    else if (element.startsWith("0x49404b7c")
                        || sig.name == "refundETH"
                        || sig.name == "selfPermit") {
                        //跳过
                    } else {
                        console.log(tx.hash);
                        exitOnError("未解析");
                    }
                });
                break;
            case "exactInputSingle":
                {
                    let args = invocation.args.params;
                    let path = new Path(args.amountIn, args.amountOutMinimum);
                    path.path = [args.tokenIn, args.tokenOut];
                    paths.push(path);
                }
                break;
            case "exactOutput":
                {
                    let args = invocation.args.params;
                    let path = new Path(args.amountOut, args.amountInMaximum, args.path);
                    path.reverse();
                    paths.push(path);
                }
                break;
            case "exactOutputSingle":
                {
                    let args = invocation.args.params;
                    let path = new Path(args.amountInMaximum, args.amountOut);
                    path.path = [args.tokenIn, args.tokenOut];
                    paths.push(path);
                }
                break;
            case "increaseLiquidity":
            case "refundETH":
                break;
            default:
                console.log(tx.hash);
                exitOnError("未解析");
                break;
        }
        return new Params(tx, invocation, paths);
    }
    parseUniV3R2(tx) {
        let invocation = this.v3r2Interface.parseTransaction(tx);
        let paths = [];
        switch (invocation.name) {
            case "multicall":
                for (let index = 0; index < invocation.args.data.length; index++) {
                    const element = invocation.args.data[index];
                    let that = this;
                    multicall(that, element);
                }
                break;
            case "exactOutput":
            case "exactOutputSingle":
            case "swapExactTokensForTokens":
            case "exactInputSingle":
            case "exactInput":
            case "swapTokensForExactTokens":
                multicall(this, tx.data);
                break;
            default:
                console.log(tx.hash);
                exitOnError("未解析");
                break;
        }
        return new Params(tx, invocation, paths);

        function multicall(that, element) {
            let sig = that.v3r2Interface.getFunction(element.substring(0, 10));
            if (element.startsWith('0x472b43f3')) {
                const invoc = that.v3r2Interface.decodeFunctionData("swapExactTokensForTokens", element);
                let path = new Path(invoc.amountIn, invoc.amountOutMin);
                path.path = invoc.path;
                paths.push(path);
            } else if (element.startsWith('0x04e45aaf')) {
                const invoc = that.v3r2Interface.decodeFunctionData("exactInputSingle", element);
                let path = new Path(invoc.params.amountIn, invoc.params.amountOutMinimum);
                path.path = [invoc.params.tokenIn, invoc.params.tokenOut];
                paths.push(path);
            } else if (element.startsWith('0x42712a67')) {
                const invoc = that.v3r2Interface.decodeFunctionData("swapTokensForExactTokens", element);
                let path = new Path(invoc.amountInMax, invoc.amountOut);
                path.path = invoc.path;
                paths.push(path);
            } else if (element.startsWith('0xb858183f')) {
                const invoc = that.v3r2Interface.decodeFunctionData("exactInput", element);
                let path = new Path(invoc.params.amountIn, invoc.params.amountOutMinimum, invoc.params.path);
                paths.push(path);
            } else if (element.startsWith('0x5023b4df')) {
                const invoc = that.v3r2Interface.decodeFunctionData("exactOutputSingle", element);
                let path = new Path(invoc.params.amountInMaximum, invoc.params.amountOut);
                path.path = [invoc.params.tokenIn, invoc.params.tokenOut];
                paths.push(path);
            } else if (sig.name == "exactOutput") {
                const invoc = that.v3r2Interface.decodeFunctionData("exactOutput", element);
                let path = new Path(invoc.params.amountOut, invoc.params.amountInMaximum, invoc.params.path);
                path.reverse();
                paths.push(path);
            } else if (sig.name == "multicall") {
                const invoc = that.v3r2Interface.decodeFunctionData(sig, element);
                invoc.data.forEach(element => {
                    multicall(that, element);
                });
            } else if (element.startsWith("0xdf2ab5bb")
                || element.startsWith("0x12210e8a")
                || element.startsWith('0xf3995c67')
                || element.startsWith('0x49404b7c')
                || sig.name == "sweepTokenWithFee"
                || sig.name == "selfPermitAllowed"
                || sig.name == "wrapETH"
                || sig.name == "increaseLiquidity"
                || sig.name == "unwrapWETH9"
                || sig.name == "sweepToken") {
                // 与交易无关，不用理会
            } else {
                console.log(tx.hash, sig.name);
                exitOnError("未解析");
            }
        }
    }
    parseUniswapUniversal(tx) {
        let invocation = this.uniInterface.parseTransaction(tx);
        let commands = invocation.args.commands;
        let inputs = invocation.args.inputs;
        let commandArr = this.parseCommands(commands);
        let paths = [];
        for (let index = 0; index < commandArr.length; index++) {
            const command = commandArr[index];
            const inputData = inputs[index];
            switch (command) {
                case UniversalCommands.V3_SWAP_EXACT_IN:
                    paths.push(this.parseUniV3SwapExactIn(inputData));
                    break;
                case UniversalCommands.V3_SWAP_EXACT_OUT:
                    let path = this.parseUniV3SwapExactIn(inputData);
                    path.reverse();
                    paths.push(path);
                    break;
                case UniversalCommands.V2_SWAP_EXACT_IN:
                    paths.push(this.parseUniV2SwapExactIn(inputData));
                    break;
                case UniversalCommands.V2_SWAP_EXACT_OUT:
                    paths.push(this.parseUniV2SwapExactOut(inputData));
                    break;
                case UniversalCommands.UNWRAP_WETH:
                case UniversalCommands.WRAP_ETH:
                case UniversalCommands.SWEEP:
                case UniversalCommands.PERMIT2_PERMIT:
                    //忽略协议
                    break;
                default:
                    console.log(tx.hash);
                    logger.debug(`未解析的协议:${command}`);


                    break;
            }
        }
        return new Params(tx, invocation, paths);
    }
    parseUniV3SwapExactIn(inputData) {
        const abiCoder = new ethers.utils.AbiCoder();
        const decodedData = abiCoder.decode(['address', 'uint256', 'uint256', 'bytes', 'bool'], inputData);
        let amountIn = decodedData[1];
        let amountOutMin = decodedData[2];
        let pathStr = decodedData[3];
        let path = new Path(amountIn, amountOutMin, pathStr);
        return path;
    }
    parseUniV2SwapExactOut(inputData) {
        const abiCoder = new ethers.utils.AbiCoder();
        const decodedData = abiCoder.decode(['address', 'uint256', 'uint256', 'address[]', 'bool'], inputData);
        let amountIn = decodedData[2];
        let amountOutMin = decodedData[1];
        let path = new Path(amountIn, amountOutMin);
        path.path = decodedData[3];
        return path;
    }
    parseUniV2SwapExactIn(inputData) {
        const abiCoder = new ethers.utils.AbiCoder();
        const decodedData = abiCoder.decode(['address', 'uint256', 'uint256', 'address[]', 'bool'], inputData);
        let amountIn = decodedData[1];
        let amountOutMin = decodedData[2];
        let path = new Path(amountIn, amountOutMin);
        path.path = decodedData[3];
        return path;
    }

    parseCommands(commands) {
        // 使用正则表达式替换指定字符为空字符串
        commands = commands.replace(new RegExp("0x", "g"), "");
        // 使用正则表达式匹配每两个字符，并将其转换为十进制数
        let hexArray = commands.match(/.{1,2}/g).map(byte => parseInt(byte, 16));
        return hexArray
    }
}

module.exports = { TransParser };