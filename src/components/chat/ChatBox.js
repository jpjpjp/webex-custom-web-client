import React from 'react';

class ChatBox extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      message: ''
    }
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    return {
      lookingState: nextProps.lookingState
    }
  }


  onChange(e) {
    this.setState({
      message: e.target.value
    })
  }

  onKeyUp(e) {
    if (e.key === 'Enter') {
      this.props.sendMessage({
        type: 'message',
        text: this.state.message
      });
      this.setState({ message: '' });
    // } else {
    //   alert('Please enter a message');
    }
  }


  render() {
    return (
      <div className="input-group chatbox col-xs-12 col-sm-12 col-md-8 col-lg-10">
        <div className="input-group-prepend">
          <button
            className="btn btn-outline-secondary"
            type="button"
            onClick={this.props.toggleAway}
          >
            <i/> {this.props.lookingState != 'away' ? (
              'Stop Looking'
            ) : ('Start Looking')}
          </button>
        </div>
          {this.props.lookingState != 'away' ? (
            <input
              className="form-control"
              placeholder="Type message"
              value={this.state.message}
              onChange={this.onChange.bind(this)}
              onKeyUp={this.onKeyUp.bind(this)}
            />
          ) : (
            <input
              className="form-control"
              placeholder="Ignoring Input While Not Looking"
              disabled
            />
          )}
      </div>
    );
  }
}

export default ChatBox;