// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IResolverRegistry
/// @notice Minimal interface the HTLC contract uses to check whether
///         an address is an active Stelleth resolver.
interface IResolverRegistry {
    /// @return active True if `resolver` is registered and has not been
    ///         slashed below the minimum stake threshold.
    function isActive(address resolver) external view returns (bool active);
}
