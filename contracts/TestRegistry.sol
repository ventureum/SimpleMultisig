pragma solidity ^0.5.8;

// This contract is only used for testing purposes.
contract TestRegistry {
    mapping(address => uint256) public registry;

    function register(uint256 x) public payable {
        registry[msg.sender] = x;
    }

}
