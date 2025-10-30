import React from "react";

const HomeRoom: React.FC = () => {
  return (
    <section className="hp-room-section">
      <div className="container-fluid">
        <div className="hp-room-items">
          <div className="row">
            {[1, 2, 3, 4].map((i) => (
              <div className="col-lg-3 col-md-6" key={i}>
                <div
                  className="hp-room-item"
                  style={{ backgroundImage: `url(/img/room/room-b${i}.jpg)` }}
                >
                  <div className="hr-text">
                    <h3>
                      {i === 1
                        ? "Double Room"
                        : i === 2
                        ? "Premium King Room"
                        : i === 3
                        ? "Deluxe Room"
                        : "Family Room"}
                    </h3>
                    <h2>
                      {i === 1
                        ? "199$"
                        : i === 2
                        ? "159$"
                        : i === 3
                        ? "198$"
                        : "299$"}
                      <span>/Pernight</span>
                    </h2>
                    <table>
                      <tbody>
                        <tr>
                          <td className="r-o">Size:</td>
                          <td>30 ft</td>
                        </tr>
                        <tr>
                          <td className="r-o">Capacity:</td>
                          <td>Max persion 5</td>
                        </tr>
                        <tr>
                          <td className="r-o">Bed:</td>
                          <td>King Beds</td>
                        </tr>
                        <tr>
                          <td className="r-o">Services:</td>
                          <td>Wifi, Television, Bathroom,...</td>
                        </tr>
                      </tbody>
                    </table>
                    <a href="#" className="primary-btn">
                      More Details
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeRoom;
