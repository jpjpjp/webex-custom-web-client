import React from 'react';

class Users extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      users: props.users,
      usersById: props.usersById,
      lastReadById: props.lastReadById,
      lastMsgId: props.lastMsgId
    }
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    return {
      users: nextProps.users,
      usersById: nextProps.usersById,
      lastReadById: nextProps.lastReadById,
      lastMsgId: nextProps.lastMsgId
    }
  }

  createTable() {
    let table = []
    let rowIndex=1;
    for (let personId in this.state.lastReadById) {
      if (this.state.lastReadById[personId] === this.state.lastMsgId) {
        table.push(<tr key={rowIndex++}><td>{this.state.usersById[personId]}</td></tr>);
      }
    }
    return table;
  }

  render() {
    return (
      <div className="users col-xs-12 col-sm-12 col-md-4 col-lg-2">
        {this.state.users.length ? this.state.users.map((user, i) => {
          return (
            <div className="user" key={i}>
              <i className="fa fa-user" /> {user}
            </div>
          )
        }) : 'No Users Online'}
        <p>Read Status Current:</p>
        <table><tbody>
          {this.createTable()}
        </tbody></table>
      </div>
    )
  }
}

export default Users;