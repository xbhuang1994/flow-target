const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/dexswap');
const AmountSchema = new mongoose.Schema({
    token: String,
    amount: String
})
const PathSchema = new mongoose.Schema({
    pathStr: String,
    path: [String],
    amountIn: String,
    amountOut: String
});

const SwapSchema = new mongoose.Schema({
    hash: String,
    routerType: String,
    gasPrice: Number,
    from: String,
    gasLimit: Number,
    firstTime: Number,
    confirmedTime: Number,
    paths: [PathSchema], // 嵌套的Path模式
    amounts: [AmountSchema]
});

const SwapModel = mongoose.model('Swap', SwapSchema);

module.exports = {
    SwapModel
}