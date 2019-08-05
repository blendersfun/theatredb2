import React, { useState } from 'react'
import { withAuthenticator } from 'aws-amplify-react'
import uuid from 'uuid/v4'
import { useHash, navigateToHash } from './useHash'

// Don't know where to put this yet.
import output from './config/infrastructure-output.json'
import Amplify, { Auth } from 'aws-amplify'
import AWS from 'aws-sdk'
Amplify.configure({
  Auth: {
    region: output.region.value,
    userPoolId: output.user_pool_id.value,
    userPoolWebClientId: output.user_pool_client_id.value,
    identityPoolId: output.identity_pool_id.value
  }
})

let _configPromise
async function ensureAWSConfig() {
  if (_configPromise) return _configPromise
  _configPromise = Auth.currentCredentials()
    .then(credentials => {
      AWS.config.credentials = credentials
      AWS.config.region = output.region.value
    })
  return _configPromise
}

async function fetchOrganizations() {
  try {
    await ensureAWSConfig()
    const documentClient = new AWS.DynamoDB.DocumentClient()
    const results = await documentClient.scan({
      TableName: 'theatredb.organizations',
      Limit: 50
    }).promise()
    return results.Items.sort((a, b) => {
      if (a.name < b.name) return -1
      if (a.name > b.name) return 1
      return 0
    })
  } catch (err) {
    console.log(err)
    return []
  }
}
async function saveOrganization(org) {
  try {
    await ensureAWSConfig()
    const documentClient = new AWS.DynamoDB.DocumentClient()
    const Item = {}
    Object.entries(org).forEach(([key, val]) => {
      if (val !== '') Item[key] = val
    })
    await documentClient.put({
      TableName: 'theatredb.organizations',
      Item
    }).promise()
  } catch (err) {
    console.log(err)
  }
}
async function getOrganization(id) {
  try {
    await ensureAWSConfig()
    const documentClient = new AWS.DynamoDB.DocumentClient()
    const result = await documentClient.get({
      TableName: 'theatredb.organizations',
      Key: {
        id
      }
    }).promise()
    return result.Item
  } catch (err) {
    console.log(err)
  }
}

class UnFetchedArray extends Array {}

function OrganizationItem(props) {
  return (
    <li>
      <PageLink
        page="edit-organization"
        hashArgs={{ 'id': props.org.id }}
        {...props}
      >
        {props.org.name}
      </PageLink>
    </li>
  )
}

function Home() {
  const [organizations, setOrganizations] = useState(new UnFetchedArray())
  if (organizations instanceof UnFetchedArray) {
    fetchOrganizations()
      .then(organizations => setOrganizations(organizations))
  }

  return (
    <div>
      <strong> Theatre Organizations </strong>
      <ul>
        {organizations.map(org => <OrganizationItem key={org.id} org={org}/>)}
      </ul>
    </div>
  )
}

function EditOrganization() {
  const hash = useHash()
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [mission, setMission] = useState('')

  // Initialize the org, either existing, or new.
  if (id === '') {
    if (hash.id) {
      getOrganization(hash.id)
        .then(org => {
          if (!org) return
          setId(org.id)
          setName(org.name)
          setMission(org.mission)
        })
    } else {
      setId(uuid())
    }
  }


  return (
    <div>
      <strong>Edit Organization</strong><br/>
      <label>Name</label><br/>
      <input value={name} onChange={e => setName(e.target.value)}/><br/>
      <label>Mission</label><br/>
      <textarea
        value={mission}
        onChange={e => setMission(e.target.value)}
        style={{ 'minWidth': '500px', 'minHeight': '100px' }}
      /><br/>
      <button onClick={() => saveOrganization({ id, name, mission })}>Save</button>
    </div>
  )
}

function EditProduction() {
  return (
    <div>
      Edit Production.
    </div>
  )
}

function EditVenue() {
  return (
    <div>
      Edit Venue.
    </div>
  )
}

function EditTheatreArtist() {
  return (
    <div>
      Edit Theatre Artist.
    </div>
  )
}

function RandomAssThoughts() {
  return (
    <div style={{'max-width': '600px'}}>
      <string> Random-Ass Thoughts </string>
      <p>
        There seem to be several types of theatre institutions. Actually, perhaps "myriad" types would be more appropriate. One type that I am particularly interested in is PRODUCING theatre organizations. Let me give you an example. Strawberry Theatre Workshop <strong>produces</strong> theatre productions. That is their main thing. They don't <em>host</em> touring productions. They are not primarily a <em>venue</em>. They do not <em>curate</em> theatre. Not to say that those other things are not legitimate things to do. But <strong>producing</strong> organizations are particularly interesting to me. Productions that are produced locally have a particular flavor. Home-grown. They are born of our body and spirit, as Seattle. They are born of our strengths and failings as a regional center for the arts. Something compelling about that. They are <em>ours</em>.
      </p>
    </div>
  )
}

const pages = {
  'home': Home,
  'edit-organization': EditOrganization,
  'edit-production': EditProduction,
  'edit-venue': EditVenue,
  'edit-theatre-artist': EditTheatreArtist,
  'random-ass-thoughts': RandomAssThoughts
}

function PageLink(props) {
  if (props.page === props.currentPage) {
    return <span>{props.children}</span>
  }
  const args = props.hashArgs
    ? '&' + Object.keys(props.hashArgs).map(key => `${key}=${props.hashArgs[key]}`).join('&')
    : ''
  return <a href={`#p=${props.page}${args}`}>{props.children}</a>
}

function Navigation(props) {
  return (
    <ol>
      <li><PageLink page="home" {...props}> Home </PageLink></li>
      <li><PageLink page="edit-organization" {...props}> New Organization </PageLink></li>
      <li><PageLink page="edit-production" {...props}> New Production </PageLink></li>
      <li><PageLink page="edit-venue" {...props}> New Venue </PageLink></li>
      <li><PageLink page="edit-theatre-artist" {...props}> New Theatre Artist </PageLink></li>
      <li><PageLink page="random-ass-thoughts" {...props}> Random-Ass Thoughts </PageLink></li>
    </ol>
  )
}

function App() {
  const hash = useHash()
  const Page = pages[hash.p] || Home

  // Redirect to page 'home', if needed.
  if (hash.p === undefined || !pages[hash.p]) {
    const { p, ...oldHash } = hash
    navigateToHash({ p: 'home', ...oldHash })
  }

  return (
    <div style={{'margin': '20px'}}>
      <Navigation currentPage={hash.p}/>
      <Page/>
    </div>
  );
}

export default withAuthenticator(App, { includeGreetings: true })
