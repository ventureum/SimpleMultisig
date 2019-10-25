var SimpleMultiSig = artifacts.require('./SimpleMultiSig.sol')

module.exports = function(deployer) {
  // deployment steps
  // rinkeby
  deployer.deploy(SimpleMultiSig, 4)

  // mainnet
  // deployer.deploy(SimpleMultiSig, 1)
}
