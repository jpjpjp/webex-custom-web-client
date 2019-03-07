import React from 'react';
import Dropdown from 'react-bootstrap/Dropdown'
import DropdownButton from 'react-bootstrap/DropdownButton'

class EnterChat extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      username: '',
      possibleUsers: require('./users.json')
    }
  }

  changeUser(i) {
    if (this.state.possibleUsers[i]) {
      this.props.setUserKey({
        token: this.state.possibleUsers[i].token,
        roomId: this.state.possibleUsers[i].rooms[0]});
    } else {
      alert('Please provide a username');
    }
  }

  render() {
    return (
      <div className="enter-chat d-flex justify-content-center align-items-center">
        <form className="col-xs-12 col-sm-12 col-md-6 col-lg-4" >
          <DropdownButton title='Select User' onSelect={this.changeUser.bind(this)}>
            {this.state.possibleUsers.map((user, i) => {
              return (
                <Dropdown.Item key={i} eventKey={i}>{user.name}</Dropdown.Item>
              )
            })}
          </DropdownButton>
        </form>
      </div>
    )
  }
}

export default EnterChat;