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
          <input
            className="form-control"
            placeholder={this.props.lookingState !== 'away' ? 
                        "Type message" : "Ignoring Input While Not Looking"}
            value={this.state.message}
            onChange={this.onChange.bind(this)}
            onKeyUp={this.onKeyUp.bind(this)}
            disabled={this.props.lookingState !== 'away' ? false : true}
          />
      </div>
    );
  }
}

export default ChatBox;