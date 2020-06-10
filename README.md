# Graph Network Subgraph

The Graph Network Subgraph.

# Deploying

To deploy to kovan run `yarn deploy-kovan`. It wraps mustache for subgraph.template and addresses
into one. 

`yarn deploy-kovan-testing` is for testing on a subgraph that no one else will tie into. 

# Subgraph Details
## Resolving names on GNS
The below shows how the following **action** on the `GNS` will result in entity changes to the
subgraph.

### Scenario 1 - Publishing at a brand new subgraph number
#### Subgraph
- Name is checked if it exists on this graph account, and it doesn’t so it is accepted as the name
  for this subgraph
- Linked to a SubgraphVersion
- Metadata stored on the Subgraph for description, image, etc.
- Curation
  - It will now allow for this URL to show up in the graph explorer and this name will result 
    in GRT => nSignal => vSignal into the subgraph version. This is all setup without the name, but
    essentially the subgraph allows the name to resolve to this SubgraphVersion => SubgraphDeployment
    and acts as a proxy.
#### SubgraphVersion
- Creates a new SubgraphVersion - with all new fields. Links metadata, links to a Subgraph and
  SubgraphDeployment
#### SubgraphDeployment
- Links the SubgraphDeployment to the SubgraphVersion 

###  Scenario 2 - Publishing a new version
#### Subgraph
- Name can be changed or not changed. If not changed, do nothing. If changed, check that name is not
  taken. If it isnt taken, set name to the new name. Move the old name into pastNames with the final
  version number it was used for
- You are linking it to a new Subgraph Version
- Metadata for the subgraph CAN be updated here, it is optional
- Curation
  - If the subgraphDeploymentID is changed in the contract, old vSignal is burnt, and exchanged
    for GRT, and then put into the new vSignal. 
#### SubgraphVersion
- Creates a new SubgraphVersion - with all new fields. Links metadata, links to a Subgraph and
  SubgraphDeployment
#### SubgraphDeployment
- Links the SubgraphDeployment to the SubgraphVersion 

###  Scenario 3 - Unpublishing
#### Subgraph
- Name is set to null. It must be set to null, as it is the only way that a user could use this
  name again
- Old name is moved into pastNames array, with the final version number
- To be unpublished means that the SubgraphVersion will be removed from currentVersion and into
  past versions. currentVersion becomes null
- Metadata is left untouched since theres no upload to IPFS 
- Curation
  - Pulls out vSignal and nSignal and returns GRT to all users
#### SubgraphVersion
- Sets unpublished to true
#### SubgraphDeployment
- Does nothing

###  Scenario 4 - Edge case - Publishing a new name to brand new subgraph, but that name is already in use
#### Subgraph
- Front end would check name and disallow. It can still be done directly to contract though. So the
  subgraph would cycle through all graph account subgraph names. **It sees it exists. So it creates
  a Subgraph, but with no name.**
- **Everything else the same as Scenario 1**

###  Scenario 5 - Edge case - Publishing a new version and name to an existing subgraph, but name's already in use
#### Subgraph
- Front end would check name and disallow. It can still be done directly to contract though. So the
  subgraph would cycle through all graph account subgraph names. It sees it exists. So it creates
  a new version, but keeps the old name
- **Everything else the same as Scenario 2**


###  Scenario 6 - Edge case - Publishing a brand new subgraph with a name you don't own
#### Subgraph
- Front end would check name and disallow. It can still be done directly to contract though.
  Subgraph would check, see the name isn't owned, and would create an unnamed subgraph (like in
  scenario 4)
- **Everything else the same as Scenario 2**

###  Scenario 7 - Edge case - Publishing a new version and name to an existing subgraph, but you don't own the name
#### Subgraph
- Front end would check name and disallow. It can still be done directly to contract though. So the
  subgraph would check, see the name isn't owned. So it creates a new version, but keeps the old name
- **Everything else the same as Scenario 2**

###  Scenario 8 - Edge Case - Republishing an unpublished subgraph number
#### Subgraph
- Just take the existing subgraph, give it a new name, ensure it is not in use
- Give it new metadata
- Create a new version
- **Everything else the same as Scenario 2**
- 