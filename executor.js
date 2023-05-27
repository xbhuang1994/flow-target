const { ethers } = require('ethers');
const logger = require('./logger.js');
class Executor {
    constructor(params) {
        this.wsNodeUrl = params.wsNodeUrl;
        this.providers = {};
        this.abiMap = {};
        this.v2Interface = new ethers.utils.Interface(this.abi('v2_router'));
        this.v3Interface = new ethers.utils.Interface(this.abi('v3_router'));
        this.v3r2Interface = new ethers.utils.Interface(this.abi('v3_router2'));
        this.uniInterface = new ethers.utils.Interface(this.abi('uni_router'));
        this.v2Address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D".toLowerCase();
        this.v3Address = "0xe592427a0aece92de3edee1f18e0157c05861564".toLowerCase();
        this.v3r2Address = "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45".toLowerCase();
        this.uniAddress = "0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b".toLowerCase();
    }
    abi(name) {
        let abi = this.abiMap[name];
        if (!abi) {
            abi = require(`./abi/${name}_abi.json`);
        }
        this.abiMap[name] = abi;
        return abi;
    }

    wsProvider() {
        return this.provider('ws');
    }
    provider(name) {
        var provider = this.providers[name];
        if (provider) {
            return provider;
        }
        provider = new ethers.providers.WebSocketProvider(this.wsNodeUrl);
        this.providers[name] = provider;
        return provider;
    }
    async getSwapPoolInfo(contractAddress) {
        let poolInfo = {
            token0: "",
            token1: ""
        }
        try {
            const poolContract = this.getContractByName('v3_pool', contractAddress);
            poolInfo.token0 = await poolContract.token0();
            poolInfo.token1 = await poolContract.token1();
            return poolInfo;
        } catch (error) {

        }
        try {
            const poolContract = this.getContractByName('v2_pool', contractAddress);
            poolInfo.token0 = await poolContract.token0();
            poolInfo.token1 = await poolContract.token1();
            return poolInfo;
        } catch (error) {
            
        }
        return null;
    }
    subscribeNewBlockTx(callback) {
        if (this.newBlockSubscribed) {
            logger.debug('subscribeNewBlockTx: already subscribed');
            return;
        }
        this.newBlockSubscribed = true;
        logger.debug('subscribeNewBlockTx: proceeding');

        this.wsSubscribeNewBlockProvider = new ethers.providers.WebSocketProvider(this.wsNodeUrl);
        this.wsSubscribeNewBlockProvider.on('block', async (blockNumber) => {
            // 获取块信息
            const block = await this.wsProvider().getBlock(blockNumber);
            if (block) {
                // 获取块中的所有交易
                const transactions = block.transactions;
                callback({ blockNumber, transactions });
            } else {
                console.log(`Block ${blockNumber} not found`);
            }
        });

    }
    unSubscribeNewBlockTx() {
        try {
            logger.debug('unSubscribeNewBlockTx');
            this.newBlockSubscribed = false;
            this.wsSubscribeNewBlockProvider._websocket.terminate();
        } catch (e) { }
    }

    subscribePendingTx(callback, delayLimit) {
        if (this.pendingSubscribed) {
            logger.debug('subscribePendingTx: already subscribed');
            return;
        }

        this.pendingSubscribed = true;
        logger.debug('subscribePendingTx: proceeding');

        this.wsSubscribeProvider = new ethers.providers.WebSocketProvider(this.wsNodeUrl);
        this.wsSubscribeProvider.on('pending', async (hash) => {
            this.count++;
            var txReceived = now();
            var tx = await this.getTransaction(hash);
            if (!(tx && tx.to && tx.data != '0x')) {
                this.dropCount++;
                return;
            }
            let txPulled = now();
            callback({ tx, time: { txReceived, txPulled } });
        });
    }

    unsubscribePendingTx() {
        try {
            logger.debug('unsubscribePendingTx');
            this.pendingSubscribed = false;
            this.wsSubscribeProvider._websocket.terminate();
        } catch (e) { }
    }



    getTransaction(txHash) {
        return this.wsProvider().getTransaction(txHash);
    }
    getTransactionReceipt(txHash) {
        const receipt = this.wsProvider().getTransactionReceipt(txHash);
        return receipt;
    }
    parseTransaction(tx) {
        let to = tx.to.toLowerCase();
        try {
            if (to == this.v2Address) {
                return this.v2Interface.parseTransaction(tx);
            } else if (to == this.v3Address) {
                return this.v3Interface.parseTransaction(tx);
            } else if (to == this.uniAddress) {
                return this.uniInterface.parseTransaction(tx);
            } else if (to == this.v3r2Address) {
                return this.v3r2Interface.parseTransaction(tx);
            }
        } catch (e) {
            logger.error('parse failed for: ' + tx.hash, e);
        }
    }
    getBalance(address) {
        return this.wsProvider().getBalance(address);
    }

    async getSymbol(tokenAddress) {
        try {
            const tokenContract = this.getErc20Contract(tokenAddress);
            const symbol = await tokenContract.symbol();
            return symbol;
        } catch (error) {
            return "";
        }
    }
    async getDecimals(tokenAddress) {
        try {
            const tokenContract = this.getErc20Contract(tokenAddress);
            const decimals = await tokenContract.decimals();
            return decimals;
        } catch (error) {
            return 18;
        }
    }
    getContractByName(name, contractAddress) {
        let tokenABI = this.abi(name);
        let provider = this.wsProvider();
        // Create a contract instance
        const tokenContract = new ethers.Contract(contractAddress, tokenABI, provider);
        return tokenContract;
    }
    getErc20Contract(tokenAddress) {
        return this.getContractByName('erc20', tokenAddress);
    }
}
function now() {
    return new Date().getTime();
}

module.exports = { Executor };